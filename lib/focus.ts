import { execSync } from "node:child_process";
import { getLiveness } from "./liveness";

export type FocusResult =
  | { ok: true; tmuxTarget: string; ghosttyActivated: boolean }
  | { ok: false; reason: string };

function sh(cmd: string, timeoutMs = 2000): string {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      timeout: timeoutMs,
      shell: "/bin/sh",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** Walk PPID chain starting from `pid`. Up to N levels. */
function ancestorPids(pid: string, max = 8): string[] {
  const chain: string[] = [pid];
  let current = pid;
  for (let i = 0; i < max; i++) {
    const parent = sh(`ps -o ppid= -p ${current} 2>/dev/null`).trim();
    if (!parent || parent === "0" || parent === "1") break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

type TmuxPane = {
  paneId: string; // e.g. "%12"
  target: string; // e.g. "main:3.0"
  panePid: string;
  cwd: string;
};

function listTmuxPanes(): TmuxPane[] {
  const out = sh(
    `tmux list-panes -a -F '#{pane_id}|#{session_name}:#{window_index}.#{pane_index}|#{pane_pid}|#{pane_current_path}' 2>/dev/null`,
  );
  if (!out) return [];
  const panes: TmuxPane[] = [];
  for (const line of out.split("\n")) {
    const [paneId, target, panePid, cwd] = line.split("|");
    if (paneId && target && panePid) {
      panes.push({ paneId, target, panePid, cwd: cwd ?? "" });
    }
  }
  return panes;
}

function pidForProjectPath(projectPath: string): string | null {
  const live = getLiveness();
  if (!live.ok) return null;
  // Find any live claude PID whose cwd matches the project path.
  // We re-run pgrep + lsof since liveness only stores counts.
  const out = sh(
    `ps -axo pid,command 2>/dev/null | awk '$2 ~ /\\/claude$/ {print $1}'`,
  );
  if (!out) return null;
  for (const pid of out.split("\n")) {
    const cwd = sh(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null | tail -1 | sed 's/^n//'`);
    if (cwd === projectPath) return pid;
  }
  return null;
}

/** Best-effort: focus the tmux pane (and Ghostty window) that runs the claude
 *  session for the given projectPath. Returns ok=false with a reason if we
 *  can't match a pane. */
export function focusProject(projectPath: string): FocusResult {
  const claudePid = pidForProjectPath(projectPath);
  if (!claudePid) {
    return { ok: false, reason: "no live claude process matches this project" };
  }

  const panes = listTmuxPanes();
  if (panes.length === 0) {
    return { ok: false, reason: "tmux not running or no panes found" };
  }

  const panePidSet = new Map(panes.map((p) => [p.panePid, p]));
  const ancestors = ancestorPids(claudePid);

  let match: TmuxPane | undefined;
  for (const pid of ancestors) {
    const found = panePidSet.get(pid);
    if (found) {
      match = found;
      break;
    }
  }

  // Fallback: cwd match
  if (!match) {
    match = panes.find((p) => p.cwd === projectPath);
  }

  if (!match) {
    return { ok: false, reason: "no tmux pane matches this session" };
  }

  // Switch tmux focus. If tmux client is attached, switch-client + select-pane.
  sh(`tmux select-window -t '${match.target.split(".")[0]}' 2>/dev/null`);
  sh(`tmux select-pane -t '${match.paneId}' 2>/dev/null`);

  // Bring Ghostty (or whichever app holds the tmux client) to the front.
  // We don't know which app owns the tmux client, so try the common ones.
  let ghostty = false;
  const ghosttyCheck = sh(`osascript -e 'tell application "System Events" to (name of processes) contains "ghostty"' 2>/dev/null`);
  if (ghosttyCheck === "true") {
    sh(`osascript -e 'tell application "Ghostty" to activate' 2>/dev/null`);
    ghostty = true;
  } else {
    // Fallback: try other common terminals
    for (const app of ["iTerm", "Terminal", "kitty", "WezTerm"]) {
      const present = sh(
        `osascript -e 'tell application "System Events" to (name of processes) contains "${app.toLowerCase()}"' 2>/dev/null`,
      );
      if (present === "true") {
        sh(`osascript -e 'tell application "${app}" to activate' 2>/dev/null`);
        break;
      }
    }
  }

  return { ok: true, tmuxTarget: match.target, ghosttyActivated: ghostty };
}
