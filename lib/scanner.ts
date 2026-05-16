import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DiscoveredSource } from "./sources";

export type DiscoveredSession = {
  sessionId: string;
  jsonlPath: string;
  hasSidecar: boolean;
  sidecarMtimeMs?: number;
  encodedProjectDir: string;
  projectPathFromDir: string;
  source: DiscoveredSource["source"];
  mtimeMs: number;
  ctimeMs: number;
  sizeBytes: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

/**
 * Walk a sidecar directory (one level deep into subdirectories) and return
 * the newest mtime among the directory itself and every file inside.
 *
 * Sidecar dirs' own mtime only updates when entries are added/removed; an
 * actively-running session appends to its subagent jsonl/meta files but
 * doesn't touch the directory metadata, so plain dir mtime goes stale.
 * Walking the inside is what tells us a session is actually being written.
 */
function newestMtimeInside(dir: string, dirMtimeMs: number): number {
  let newest = dirMtimeMs;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(cur, name);
      try {
        const s = statSync(full);
        if (s.isDirectory()) {
          stack.push(full);
        } else if (s.mtimeMs > newest) {
          newest = s.mtimeMs;
        }
      } catch {
        // ignore
      }
    }
  }
  return newest;
}

function decodeProjectPath(encoded: string): string {
  // ~/.claude convention: replace `/` with `-`. The encoded dir starts with `-`
  // representing the leading slash of an absolute path. Decoding is approximate:
  // first leading `-` becomes `/`, remaining `-` between segments become `/`.
  // We can't perfectly recover paths that contained literal hyphens, but this
  // is good enough for display.
  if (!encoded) return encoded;
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
}

export function scanSessions(src: DiscoveredSource): DiscoveredSession[] {
  const results: DiscoveredSession[] = [];
  const projectsDir = src.projectsDir;
  if (!existsSync(projectsDir)) return results;

  let projectDirs: string[] = [];
  try {
    projectDirs = readdirSync(projectsDir);
  } catch {
    return results;
  }

  for (const encodedProject of projectDirs) {
    const projectAbs = join(projectsDir, encodedProject);
    let isDir = false;
    try {
      isDir = statSync(projectAbs).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;

    let entries: string[] = [];
    try {
      entries = readdirSync(projectAbs);
    } catch {
      continue;
    }

    const jsonlNames = entries.filter((n) => UUID_RE.test(n));
    const sidecarMtimes = new Map<string, number>();
    for (const n of entries) {
      try {
        const full = join(projectAbs, n);
        const s = statSync(full);
        if (s.isDirectory()) sidecarMtimes.set(n, newestMtimeInside(full, s.mtimeMs));
      } catch {
        // ignore
      }
    }

    for (const jsonlName of jsonlNames) {
      const sessionId = jsonlName.replace(/\.jsonl$/i, "");
      const jsonlPath = join(projectAbs, jsonlName);
      let st;
      try {
        st = statSync(jsonlPath);
      } catch {
        continue;
      }
      const sidecarMtime = sidecarMtimes.get(sessionId);
      results.push({
        sessionId,
        jsonlPath,
        hasSidecar: sidecarMtime !== undefined,
        sidecarMtimeMs: sidecarMtime,
        encodedProjectDir: encodedProject,
        projectPathFromDir: decodeProjectPath(encodedProject),
        source: src.source,
        mtimeMs: st.mtimeMs,
        ctimeMs: st.ctimeMs,
        sizeBytes: st.size,
      });
    }
  }

  return results;
}
