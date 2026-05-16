import { existsSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { discoverSources, type DiscoveredSource } from "./sources";
import { scanSessions, type DiscoveredSession } from "./scanner";
import { parseSession } from "./parser";
import { classifyStatus } from "./state";
import { getLiveness, type Liveness } from "./liveness";
import type { SessionCard } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recomputeStatuses(cards: SessionCard[], liveness: Liveness, now: number) {
  const liveSessionIds = new Set<string>();
  if (liveness.ok) {
    const byProject = new Map<string, SessionCard[]>();
    for (const c of cards) {
      // Prefer projectPath (the actual cwd recorded in the JSONL). Only fall
      // back to projectPathFromDir when cwd extraction failed — i.e., the
      // two are equal. When they differ, projectPathFromDir is the parent
      // directory of projectPath (Claude Code groups child-cwd sessions
      // under their git-root-ish parent dir); matching by the parent would
      // falsely tag this session as live whenever any sibling session in
      // the parent dir has a live process. focus.ts matches on projectPath
      // exact-cwd, so liveness must use the same key to stay consistent.
      const pp = c.projectPath;
      const ppfd = c.projectPathFromDir;
      const cwdExtracted = pp !== ppfd;
      const key =
        pp && liveness.liveProjectProcCount.has(pp)
          ? pp
          : cwdExtracted
            ? null
            : ppfd && liveness.liveProjectProcCount.has(ppfd)
              ? ppfd
              : null;
      if (!key) continue;
      const arr = byProject.get(key) ?? [];
      arr.push(c);
      byProject.set(key, arr);
    }
    for (const [proj, arr] of byProject) {
      const n = liveness.liveProjectProcCount.get(proj) ?? 0;
      // Prefer sessions whose sidecar directory is fresh — Claude Code only
      // touches the sidecar while a session is actively running, so this is
      // a much more reliable "alive" signal than JSONL mtime alone (JSONLs
      // keep their last-written time forever, even after the session ends).
      arr.sort((a, b) => {
        const aSide = a.sidecarMtimeMs ?? 0;
        const bSide = b.sidecarMtimeMs ?? 0;
        if (aSide !== bSide) return bSide - aSide;
        return b.lastActivityAt - a.lastActivityAt;
      });
      for (let i = 0; i < Math.min(n, arr.length); i++) {
        liveSessionIds.add(arr[i].id);
      }
    }
  }

  for (const c of cards) {
    c.status = classifyStatus(c, now, {
      isThisLive: liveSessionIds.has(c.id),
      livenessOk: liveness.ok,
    });
  }
}

export type SnapshotOptions = {
  /** When true, return only active sessions (working/waiting). */
  activeOnly?: boolean;
};

export function buildSnapshot(opts: SnapshotOptions = {}): SessionCard[] {
  const now = Date.now();
  const liveness = getLiveness();

  const cards: SessionCard[] = [];
  for (const src of discoverSources()) {
    for (const sess of scanSessions(src)) {
      cards.push(parseSession(sess));
    }
  }

  recomputeStatuses(cards, liveness, now);
  cards.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

  if (opts.activeOnly) {
    return cards.filter((c) => c.status !== "inactive");
  }
  return cards;
}

/** Lightweight count used by the main page to link to the archive. */
export function countInactive(): number {
  const all = buildSnapshot();
  return all.filter((c) => c.status === "inactive").length;
}

/**
 * Apply an incremental diff for one changed file path.
 * Returns the affected card (upsert), removal id, or null when nothing to do.
 *
 * Note: status of *other* cards may shift (e.g., a session becoming the most
 * recent one in its project changes who counts as "live"). For now, callers
 * still recompute statuses across the whole snapshot — cheap because parsing
 * is the costly part, not classification.
 */
export type Patch =
  | { kind: "upsert"; card: SessionCard }
  | { kind: "remove"; id: string };

function extractSessionInfo(
  changedPath: string,
  rootProjectsDir: string,
  sources: DiscoveredSource[],
): { src: DiscoveredSource; sess: DiscoveredSession } | null {
  const src = sources.find((s) => s.projectsDir === rootProjectsDir);
  if (!src) return null;

  const rel = changedPath.startsWith(rootProjectsDir)
    ? changedPath.slice(rootProjectsDir.length + 1)
    : changedPath;
  // rel looks like: <encoded-project>/<UUID>(.jsonl)?(/...optional)
  const segments = rel.split("/");
  if (segments.length < 2) return null;
  const encodedProject = segments[0];
  const second = segments[1].replace(/\.jsonl$/i, "");
  if (!UUID_RE.test(second)) return null;

  const sessionId = second;
  const projectAbs = `${rootProjectsDir}/${encodedProject}`;
  const jsonlPath = `${projectAbs}/${sessionId}.jsonl`;
  if (!existsSync(jsonlPath)) return null;

  let st;
  try {
    st = statSync(jsonlPath);
  } catch {
    return null;
  }

  let hasSidecar = false;
  try {
    hasSidecar = statSync(`${projectAbs}/${sessionId}`).isDirectory();
  } catch {
    hasSidecar = false;
  }

  const sess: DiscoveredSession = {
    sessionId,
    jsonlPath,
    hasSidecar,
    encodedProjectDir: encodedProject,
    projectPathFromDir: encodedProject.replace(/^-/, "/").replace(/-/g, "/"),
    source: src.source,
    mtimeMs: st.mtimeMs,
    ctimeMs: st.ctimeMs,
    sizeBytes: st.size,
  };

  return { src, sess };
}

export function diffSnapshot(
  previous: SessionCard[],
  changedPath: string | null,
  rootProjectsDir: string,
  opts: SnapshotOptions = {},
): { cards: SessionCard[]; patches: Patch[] } {
  if (!changedPath) {
    const cards = buildSnapshot(opts);
    return { cards, patches: [] };
  }

  const sources = discoverSources();
  const info = extractSessionInfo(changedPath, rootProjectsDir, sources);
  if (!info) {
    return { cards: previous, patches: [] };
  }

  const card = parseSession(info.sess);
  const next = previous.slice();
  const idx = next.findIndex((c) => c.id === card.id);
  if (idx >= 0) next[idx] = card;
  else next.push(card);

  const liveness = getLiveness();
  recomputeStatuses(next, liveness, Date.now());
  next.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

  if (opts.activeOnly) {
    const filtered = next.filter((c) => c.status !== "inactive");
    const stillActive = filtered.some((c) => c.id === card.id);
    if (stillActive) {
      return {
        cards: filtered,
        patches: [{ kind: "upsert", card: filtered.find((c) => c.id === card.id)! }],
      };
    } else {
      return {
        cards: filtered,
        patches: [{ kind: "remove", id: card.id }],
      };
    }
  }

  return {
    cards: next,
    patches: [{ kind: "upsert", card: next.find((c) => c.id === card.id)! }],
  };
}

// Make basename available without the import warning above.
void basename;
void dirname;
