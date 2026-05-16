import { existsSync, readFileSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import type { DiscoveredSession } from "./scanner";
import type { SessionCard } from "./types";

const TAIL_BYTES = 64 * 1024;
const HEAD_BYTES = 256 * 1024;
const FULL_PARSE_MAX_BYTES = 4 * 1024 * 1024;

type IndexEntry = {
  sessionId?: string;
  fullPath?: string;
  fileMtime?: number;
  firstPrompt?: string;
  summary?: string;
  messageCount?: number;
  created?: string;
  modified?: string;
  gitBranch?: string;
  projectPath?: string;
  isSidechain?: boolean;
};

type SessionsIndex =
  | { version?: number; entries?: IndexEntry[] }
  | { sessions?: Record<string, IndexEntry> | IndexEntry[] }
  | IndexEntry[]
  | Record<string, IndexEntry>;

const indexCache = new Map<string, { mtimeMs: number; map: Map<string, IndexEntry> }>();

function loadIndex(projectAbsDir: string): Map<string, IndexEntry> {
  const indexPath = join(projectAbsDir, "sessions-index.json");
  if (!existsSync(indexPath)) return new Map();
  let st;
  try {
    st = statSync(indexPath);
  } catch {
    return new Map();
  }
  const cached = indexCache.get(indexPath);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.map;

  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf8");
  } catch {
    return new Map();
  }
  let parsed: SessionsIndex;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Map();
  }

  const map = new Map<string, IndexEntry>();
  const collect = (entries: IndexEntry[] | Record<string, IndexEntry>) => {
    if (Array.isArray(entries)) {
      for (const e of entries) {
        const id = e.sessionId ?? (e.fullPath ? basename(e.fullPath, ".jsonl") : undefined);
        if (id) map.set(id, e);
      }
    } else {
      for (const [k, v] of Object.entries(entries)) {
        const id = v?.sessionId ?? k;
        map.set(id, v ?? {});
      }
    }
  };

  if (Array.isArray(parsed)) {
    collect(parsed);
  } else if (Array.isArray((parsed as { entries?: unknown }).entries)) {
    collect((parsed as { entries: IndexEntry[] }).entries);
  } else if ((parsed as { sessions?: unknown }).sessions) {
    const s = (parsed as { sessions: IndexEntry[] | Record<string, IndexEntry> }).sessions;
    collect(s);
  } else {
    collect(parsed as Record<string, IndexEntry>);
  }

  indexCache.set(indexPath, { mtimeMs: st.mtimeMs, map });
  return map;
}

function readTail(path: string, bytes: number): string {
  let fd: number | null = null;
  try {
    const st = statSync(path);
    const size = st.size;
    const len = Math.min(bytes, size);
    const offset = size - len;
    const buf = Buffer.alloc(len);
    fd = openSync(path, "r");
    readSync(fd, buf, 0, len, offset);
    return buf.toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

type JsonlEntry = {
  type?: string;
  role?: string;
  message?: {
    role?: string;
    model?: string;
    content?: unknown;
    stop_reason?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  cwd?: string;
  gitBranch?: string;
  sessionId?: string;
  attachment?: { type?: string; hookName?: string };
  promptId?: string;
  timestamp?: string | number;
  isSidechain?: boolean;
  customTitle?: string;
  aiTitle?: string;
  agentName?: string;
};

const META_TYPES = new Set([
  "last-prompt",
  "permission-mode",
  "file-history-snapshot",
  "attachment",
  "system",
  "custom-title",
  "ai-title",
  "agent-name",
]);

function isMessageEntry(e: JsonlEntry): "user" | "assistant" | null {
  const role = e.role ?? e.message?.role;
  const t = e.type ?? "";
  if (META_TYPES.has(t)) return null;
  if (e.attachment) return null;
  if (role === "user" || t === "user") return "user";
  if (role === "assistant" || t === "assistant") return "assistant";
  return null;
}

function extractContentText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as { type?: string; text?: string };
      if (p?.type === "text" && typeof p.text === "string") return p.text;
    }
  }
  return undefined;
}

// Strip slash-command boilerplate from the raw prompt BEFORE we truncate it to
// 240 chars. Without this, a 240-char cut can fall inside an unclosed
// <local-command-caveat>...</local-command-caveat> block and downstream
// regex-based cleaners can't repair it.
const PARSER_META_TAG_NAMES =
  "(?:local-command-(?:caveat|stdout|stderr|args)|command-(?:name|message|args)|system-reminder|bash-(?:input|stdout|stderr))";
const PARSER_META_TAG_RE = new RegExp(
  `<${PARSER_META_TAG_NAMES}\\b[^>]*>[\\s\\S]*?<\\/${PARSER_META_TAG_NAMES}>`,
  "gi",
);
const PARSER_UNCLOSED_META_RE = new RegExp(
  `<${PARSER_META_TAG_NAMES}\\b[^>]*>[\\s\\S]*$`,
  "i",
);

function cleanPromptRaw(raw: string): string {
  return raw
    .replace(PARSER_META_TAG_RE, " ")
    .replace(PARSER_UNCLOSED_META_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tsFromEntry(e: JsonlEntry): number | undefined {
  if (typeof e.timestamp === "string") {
    const t = Date.parse(e.timestamp);
    if (!Number.isNaN(t)) return t;
  } else if (typeof e.timestamp === "number") {
    return e.timestamp > 1e12 ? e.timestamp : e.timestamp * 1000;
  }
  return undefined;
}

type FullExtract = {
  firstPrompt?: string;
  lastPrompt?: string;
  messageCount: number;
  lastEntryRole?: SessionCard["lastEntryRole"];
  lastStopReason?: string;
  lastToolName?: string;
  model?: string;
  cwd?: string;
  gitBranch?: string;
  openedAt?: number;
  tokens?: SessionCard["tokens"];
  customTitle?: string;
  aiTitle?: string;
};

function parseLines(
  lines: string[],
  opts: {
    skipFirstPartial: boolean;
    collectFirstPrompt: boolean;
    collectLastPrompt: boolean;
    collectMsgCount: boolean;
  },
): FullExtract {
  const out: FullExtract = { messageCount: 0 };
  const start = opts.skipFirstPartial && lines.length > 1 ? 1 : 0;

  // Forward pass: first prompt, opened at, message count
  if (opts.collectFirstPrompt || opts.collectMsgCount) {
    for (let i = start; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln.trim()) continue;
      let e: JsonlEntry;
      try {
        e = JSON.parse(ln);
      } catch {
        continue;
      }
      if (out.openedAt === undefined) {
        const t = tsFromEntry(e);
        if (t !== undefined) out.openedAt = t;
      }
      const kind = isMessageEntry(e);
      if (kind === null) continue;
      if (opts.collectMsgCount) out.messageCount++;
      if (opts.collectFirstPrompt && out.firstPrompt === undefined && kind === "user") {
        const text = extractContentText(e.message?.content);
        if (text) {
          const cleaned = cleanPromptRaw(text);
          if (cleaned) out.firstPrompt = cleaned.slice(0, 240);
        }
      }
    }
  }

  // Backward pass: latest signals
  for (let i = lines.length - 1; i >= start; i--) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    let e: JsonlEntry;
    try {
      e = JSON.parse(ln);
    } catch {
      continue;
    }
    if (out.cwd === undefined && typeof e.cwd === "string") out.cwd = e.cwd;
    if (out.gitBranch === undefined && typeof e.gitBranch === "string") {
      out.gitBranch = e.gitBranch;
    }
    if (out.customTitle === undefined && e.type === "custom-title" && typeof e.customTitle === "string") {
      out.customTitle = e.customTitle;
    }
    // Claude Code emits both `ai-title` (the auto-generated session slug) and
    // `agent-name` (subagent label) as meta entries. We surface the ai-title
    // as a softer fallback chip for sessions the user never `/rename`'d.
    if (out.aiTitle === undefined && e.type === "ai-title" && typeof e.aiTitle === "string") {
      out.aiTitle = e.aiTitle;
    }
    if (out.aiTitle === undefined && e.type === "agent-name" && typeof e.agentName === "string") {
      out.aiTitle = e.agentName;
    }
    if (out.model === undefined && e.message?.model) out.model = e.message.model;
    if (out.tokens === undefined && e.message?.usage) {
      const u = e.message.usage;
      out.tokens = {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
      };
    }

    const kind = isMessageEntry(e);
    if (out.lastToolName === undefined && kind === "assistant") {
      const content = e.message?.content;
      if (Array.isArray(content)) {
        for (let j = content.length - 1; j >= 0; j--) {
          const c = content[j] as { type?: string; name?: string };
          if (c?.type === "tool_use" && typeof c.name === "string") {
            out.lastToolName = c.name;
            break;
          }
        }
      }
    }

    if (out.lastEntryRole === undefined && kind !== null) {
      out.lastEntryRole = kind;
      if (kind === "assistant" && e.message?.stop_reason) {
        out.lastStopReason = e.message.stop_reason;
      }
    }

    if (
      opts.collectLastPrompt &&
      out.lastPrompt === undefined &&
      kind === "user"
    ) {
      const text = extractContentText(e.message?.content);
      if (text) {
        const cleaned = cleanPromptRaw(text);
        if (cleaned) out.lastPrompt = cleaned.slice(0, 240);
      }
    }

    if (
      out.lastEntryRole &&
      out.lastToolName &&
      out.model &&
      out.cwd &&
      (!opts.collectLastPrompt || out.lastPrompt)
    )
      break;
  }

  return out;
}

function fullParse(path: string): FullExtract | null {
  let st;
  try {
    st = statSync(path);
  } catch {
    return null;
  }
  if (st.size > FULL_PARSE_MAX_BYTES) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split("\n");
  return parseLines(lines, {
    skipFirstPartial: false,
    collectFirstPrompt: true,
    collectLastPrompt: true,
    collectMsgCount: true,
  });
}

function tailParse(path: string): FullExtract {
  const tail = readTail(path, TAIL_BYTES);
  const lines = tail.split("\n");
  return parseLines(lines, {
    skipFirstPartial: true,
    collectFirstPrompt: false,
    collectLastPrompt: true,
    collectMsgCount: false,
  });
}

function readHeadBytes(path: string, bytes: number): string {
  let fd: number | null = null;
  try {
    const buf = Buffer.alloc(bytes);
    fd = openSync(path, "r");
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

function headParse(path: string): { firstPrompt?: string; openedAt?: number } {
  const head = readHeadBytes(path, HEAD_BYTES);
  if (!head) return {};
  const lines = head.split("\n");
  // Drop the last (possibly partial) line.
  if (lines.length > 1) lines.pop();
  const ex = parseLines(lines, {
    skipFirstPartial: false,
    collectFirstPrompt: true,
    collectLastPrompt: false,
    collectMsgCount: false,
  });
  return { firstPrompt: ex.firstPrompt, openedAt: ex.openedAt };
}

const parseCache = new Map<string, { mtimeMs: number; result: FullExtract }>();

function getExtract(d: DiscoveredSession, useFull: boolean): FullExtract {
  const cacheKey = `${d.jsonlPath}::${useFull ? "full" : "tail"}`;
  const cached = parseCache.get(cacheKey);
  if (cached && cached.mtimeMs === d.mtimeMs) return cached.result;

  let result: FullExtract;
  if (useFull) {
    const full = fullParse(d.jsonlPath);
    if (full) {
      result = full;
    } else {
      // File too large for full parse — head for firstPrompt/openedAt,
      // tail for latest signals.
      const tail = tailParse(d.jsonlPath);
      const head = headParse(d.jsonlPath);
      result = {
        ...tail,
        firstPrompt: tail.firstPrompt ?? head.firstPrompt,
        openedAt: tail.openedAt ?? head.openedAt,
      };
    }
  } else {
    result = tailParse(d.jsonlPath);
  }

  parseCache.set(cacheKey, { mtimeMs: d.mtimeMs, result });
  return result;
}

export function parseSession(d: DiscoveredSession): SessionCard {
  const projectAbsDir = dirname(d.jsonlPath);
  const indexMap = loadIndex(projectAbsDir);
  const idx = indexMap.get(d.sessionId);

  // If indexed, only tail-parse (cheap). Otherwise full-parse for proper firstPrompt + msgCount.
  const ex = getExtract(d, !idx);

  let openedAt: number | undefined;
  if (idx?.created) {
    const t = Date.parse(idx.created);
    if (!Number.isNaN(t)) openedAt = t;
  }
  if (openedAt === undefined) openedAt = ex.openedAt;

  const projectPath = idx?.projectPath ?? ex.cwd ?? d.projectPathFromDir;
  const projectName = basename(projectPath) || projectPath;

  return {
    id: d.sessionId,
    source: d.source,
    jsonlPath: d.jsonlPath,
    hasSidecar: d.hasSidecar,
    sidecarMtimeMs: d.sidecarMtimeMs,
    status: "inactive",
    projectPath,
    projectPathFromDir: d.projectPathFromDir,
    projectName,
    gitBranch: idx?.gitBranch ?? ex.gitBranch,
    model: ex.model,
    openedAt: openedAt ?? d.ctimeMs,
    lastActivityAt: d.mtimeMs,
    messageCount: idx?.messageCount ?? ex.messageCount,
    firstPrompt: idx?.firstPrompt ?? ex.firstPrompt,
    lastPrompt: ex.lastPrompt,
    summary: idx?.summary,
    customTitle: ex.customTitle,
    aiTitle: ex.aiTitle,
    lastEntryRole: ex.lastEntryRole,
    lastStopReason: ex.lastStopReason,
    lastToolName: ex.lastToolName,
    tokens: ex.tokens,
  };
}
