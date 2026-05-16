import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { discoverSources } from "./sources";

export type WatchEvent = {
  /** Absolute path inside `projects/` that changed (file or dir). */
  changedPath: string | null;
  /** Discovered source root this event belongs to. */
  rootProjectsDir: string;
};

export type WatchCallback = (event: WatchEvent) => void;

const DEBOUNCE_MS = 200;

export function startSnapshotWatcher(cb: WatchCallback): () => void {
  const watchers: FSWatcher[] = [];
  const pending = new Map<string, { paths: Set<string>; timer: ReturnType<typeof setTimeout> }>();

  const flush = (rootProjectsDir: string) => {
    const slot = pending.get(rootProjectsDir);
    if (!slot) return;
    pending.delete(rootProjectsDir);
    const paths = Array.from(slot.paths);
    if (paths.length === 0) {
      cb({ changedPath: null, rootProjectsDir });
      return;
    }
    for (const p of paths) {
      try {
        cb({ changedPath: p, rootProjectsDir });
      } catch {
        // ignore handler errors
      }
    }
  };

  const schedule = (rootProjectsDir: string, changed: string | null) => {
    let slot = pending.get(rootProjectsDir);
    if (!slot) {
      slot = {
        paths: new Set<string>(),
        timer: setTimeout(() => flush(rootProjectsDir), DEBOUNCE_MS),
      };
      pending.set(rootProjectsDir, slot);
    } else {
      clearTimeout(slot.timer);
      slot.timer = setTimeout(() => flush(rootProjectsDir), DEBOUNCE_MS);
    }
    if (changed) slot.paths.add(changed);
  };

  for (const src of discoverSources()) {
    try {
      const root = src.projectsDir;
      const w = watch(root, { recursive: true }, (_event, filename) => {
        const changed = filename ? join(root, filename.toString()) : null;
        schedule(root, changed);
      });
      w.on("error", () => {
        // ignore individual watcher errors
      });
      watchers.push(w);
    } catch {
      // skip sources that can't be watched
    }
  }

  return () => {
    for (const slot of pending.values()) clearTimeout(slot.timer);
    pending.clear();
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        // ignore
      }
    }
  };
}
