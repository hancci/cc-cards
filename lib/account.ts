import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { join } from "node:path";

export type ClaudeLogin = {
  email: string;
  organizationUuid?: string;
  accountUuid?: string;
  source: string; // e.g. "~/.claude/.claude.json" or "~/.ccs/instances/team/.claude.json"
};

export type Account = {
  user: string;
  host: string;
  gitName?: string;
  claude?: ClaudeLogin;
};

function readClaudeConfigCandidates(): string[] {
  const home = homedir();
  const candidates: string[] = [];
  // Local install
  candidates.push(join(home, ".claude", ".claude.json"));
  // CCS instances
  const ccsInstances = join(home, ".ccs", "instances");
  if (existsSync(ccsInstances)) {
    try {
      for (const entry of readdirSync(ccsInstances)) {
        if (entry.startsWith(".")) continue;
        const p = join(ccsInstances, entry, ".claude.json");
        candidates.push(p);
      }
    } catch {
      // ignore
    }
  }
  return candidates.filter((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

function tryExtractLogin(path: string): ClaudeLogin | null {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const oauth = (parsed as { oauthAccount?: unknown }).oauthAccount;
    if (!oauth || typeof oauth !== "object") return null;
    const o = oauth as Record<string, unknown>;
    const email = typeof o.emailAddress === "string" ? o.emailAddress : undefined;
    if (!email) return null;
    return {
      email,
      organizationUuid:
        typeof o.organizationUuid === "string" ? o.organizationUuid : undefined,
      accountUuid:
        typeof o.accountUuid === "string" ? o.accountUuid : undefined,
      source: path.replace(homedir(), "~"),
    };
  } catch {
    return null;
  }
}

const cachedClaude: ClaudeLogin | undefined = (() => {
  for (const p of readClaudeConfigCandidates()) {
    const login = tryExtractLogin(p);
    if (login) return login;
  }
  return undefined;
})();

const cachedGitName: string | undefined = (() => {
  try {
    const out = execSync("git config user.name", {
      encoding: "utf8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
})();

export function getAccount(): Account {
  let user = "user";
  try {
    user = userInfo().username || user;
  } catch {
    // fall back to default
  }
  const rawHost = hostname() || "localhost";
  const host = rawHost.replace(/\.local$/i, "");
  return {
    user,
    host,
    gitName: cachedGitName,
    claude: cachedClaude,
  };
}

export function preferredDisplayName(acc: Account): string {
  if (acc.claude) {
    // Use local-part of email for readability; full email in subtitle.
    const local = acc.claude.email.split("@")[0];
    return local || acc.claude.email;
  }
  if (acc.gitName) return acc.gitName;
  return acc.user;
}
