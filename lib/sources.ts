import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Source } from "./types";

export type DiscoveredSource = {
  source: Source;
  root: string;        // directory containing `projects/`
  projectsDir: string; // resolved (real) path to projects/
};

export function discoverSources(): DiscoveredSource[] {
  const home = homedir();
  const found: DiscoveredSource[] = [];
  const seen = new Set<string>();

  const tryAdd = (source: Source, root: string) => {
    const projects = join(root, "projects");
    if (!existsSync(projects)) return;
    let real: string;
    try {
      real = realpathSync(projects);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    found.push({ source, root, projectsDir: real });
  };

  // 1. Local ~/.claude
  tryAdd({ kind: "local" }, join(home, ".claude"));

  // 2. CCS instances ~/.ccs/instances/<name>
  const ccsInstances = join(home, ".ccs", "instances");
  if (existsSync(ccsInstances)) {
    let entries: string[] = [];
    try {
      entries = readdirSync(ccsInstances);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      const instanceRoot = join(ccsInstances, entry);
      try {
        if (!statSync(instanceRoot).isDirectory()) continue;
      } catch {
        continue;
      }
      tryAdd({ kind: "ccs", instance: entry }, instanceRoot);
    }
  }

  return found;
}
