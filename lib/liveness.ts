import { execSync } from "node:child_process";

export type Liveness = {
  /** For each cwd that hosts at least one live `claude` process, the count. */
  liveProjectProcCount: Map<string, number>;
  ok: boolean;
};

const CACHE_MS = 2_000;
let cache: { value: Liveness; at: number } | null = null;

function listClaudePids(): string[] {
  try {
    // macOS pgrep can miss processes launched from session leaders (e.g.,
    // claude spawned by ccs). `ps -axo` enumerates *every* process the user
    // can see, so it catches them.
    const out = execSync(
      "ps -axo pid,command 2>/dev/null | awk '$2 ~ /\\/claude$/ {print $1}'",
      {
        encoding: "utf8",
        timeout: 2000,
        shell: "/bin/sh",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function cwdOfPid(pid: string): string | null {
  try {
    const out = execSync(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`, {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const line of out.split("\n").reverse()) {
      if (line.startsWith("n")) return line.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

export function getLiveness(): Liveness {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.value;

  const counts = new Map<string, number>();
  let ok = false;
  try {
    const pids = listClaudePids();
    ok = true;
    for (const pid of pids) {
      const cwd = cwdOfPid(pid);
      if (!cwd) continue;
      counts.set(cwd, (counts.get(cwd) ?? 0) + 1);
    }
  } catch {
    ok = false;
  }

  const value: Liveness = { liveProjectProcCount: counts, ok };
  cache = { value, at: now };
  return value;
}

export function clearLivenessCache(): void {
  cache = null;
}
