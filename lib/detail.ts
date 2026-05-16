import { readFileSync, statSync } from "node:fs";
import type { SessionCard } from "./types";

export type TimelineRole = "user" | "assistant" | "system" | "meta";

export type TimelineEntry = {
  index: number;
  type: string;
  role: TimelineRole;
  ts?: number;
  text?: string;
  toolName?: string;
  toolInput?: string;
  stopReason?: string;
  model?: string;
  tokens?: { input: number; output: number; cacheRead: number };
};

export type SessionDetail = {
  entries: TimelineEntry[];
  totalEntries: number;
  truncated: boolean;
  stats: {
    userCount: number;
    assistantCount: number;
    metaCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheRead: number;
    toolUsage: Record<string, number>;
    durationMs: number;
  };
};

const MAX_FILE_BYTES_FOR_DETAIL = 32 * 1024 * 1024; // 32 MB

const META_TYPES = new Set([
  "last-prompt",
  "permission-mode",
  "file-history-snapshot",
  "attachment",
  "system",
  "custom-title",
  "summary",
]);

type RawEntry = {
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
    };
  };
  timestamp?: string | number;
};

function tsFrom(e: RawEntry): number | undefined {
  if (typeof e.timestamp === "string") {
    const t = Date.parse(e.timestamp);
    if (!Number.isNaN(t)) return t;
  } else if (typeof e.timestamp === "number") {
    return e.timestamp > 1e12 ? e.timestamp : e.timestamp * 1000;
  }
  return undefined;
}

function classifyRole(t: string, msgRole?: string): TimelineRole {
  if (META_TYPES.has(t)) return "meta";
  if (msgRole === "user" || t === "user") return "user";
  if (msgRole === "assistant" || t === "assistant") return "assistant";
  if (t === "system") return "system";
  return "meta";
}

function extractText(content: unknown, max = 1200): string | undefined {
  if (typeof content === "string") return content.slice(0, max);
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const c of content) {
      const p = c as { type?: string; text?: string; name?: string };
      if (p?.type === "text" && typeof p.text === "string") parts.push(p.text);
    }
    const joined = parts.join("\n\n");
    if (joined) return joined.slice(0, max);
  }
  return undefined;
}

function extractToolUse(
  content: unknown,
): { name?: string; input?: string } | undefined {
  if (!Array.isArray(content)) return undefined;
  for (let i = content.length - 1; i >= 0; i--) {
    const c = content[i] as { type?: string; name?: string; input?: unknown };
    if (c?.type === "tool_use") {
      let inputStr: string | undefined;
      try {
        if (c.input !== undefined) {
          inputStr = JSON.stringify(c.input).slice(0, 600);
        }
      } catch {
        // ignore
      }
      return { name: typeof c.name === "string" ? c.name : undefined, input: inputStr };
    }
  }
  return undefined;
}

export function getSessionDetail(
  jsonlPath: string,
  recentLimit = 200,
): SessionDetail | null {
  let st;
  try {
    st = statSync(jsonlPath);
  } catch {
    return null;
  }
  if (st.size > MAX_FILE_BYTES_FOR_DETAIL) {
    return null;
  }
  let raw: string;
  try {
    raw = readFileSync(jsonlPath, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split("\n");

  const all: TimelineEntry[] = [];
  const stats = {
    userCount: 0,
    assistantCount: 0,
    metaCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheRead: 0,
    toolUsage: {} as Record<string, number>,
    durationMs: 0,
  };

  let firstTs: number | undefined;
  let lastTs: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim()) continue;
    let e: RawEntry;
    try {
      e = JSON.parse(ln);
    } catch {
      continue;
    }
    const t = e.type ?? "";
    const role = classifyRole(t, e.message?.role ?? e.role);
    if (role === "user") stats.userCount++;
    else if (role === "assistant") stats.assistantCount++;
    else stats.metaCount++;

    const ts = tsFrom(e);
    if (ts) {
      if (firstTs === undefined) firstTs = ts;
      lastTs = ts;
    }

    const text = extractText(e.message?.content);
    const tool = role === "assistant" ? extractToolUse(e.message?.content) : undefined;
    if (tool?.name) {
      stats.toolUsage[tool.name] = (stats.toolUsage[tool.name] ?? 0) + 1;
    }

    const usage = e.message?.usage;
    if (usage) {
      stats.totalInputTokens += usage.input_tokens ?? 0;
      stats.totalOutputTokens += usage.output_tokens ?? 0;
      stats.totalCacheRead += usage.cache_read_input_tokens ?? 0;
    }

    all.push({
      index: i,
      type: t,
      role,
      ts,
      text,
      toolName: tool?.name,
      toolInput: tool?.input,
      stopReason: e.message?.stop_reason,
      model: e.message?.model,
      tokens: usage
        ? {
            input: usage.input_tokens ?? 0,
            output: usage.output_tokens ?? 0,
            cacheRead: usage.cache_read_input_tokens ?? 0,
          }
        : undefined,
    });
  }

  if (firstTs && lastTs && lastTs >= firstTs) {
    stats.durationMs = lastTs - firstTs;
  }

  const total = all.length;
  const entries = total > recentLimit ? all.slice(-recentLimit) : all;
  return {
    entries,
    totalEntries: total,
    truncated: total > recentLimit,
    stats,
  };
}

export function findSessionCardById(id: string, snapshot: SessionCard[]): SessionCard | null {
  for (const c of snapshot) if (c.id === id) return c;
  return null;
}
