export type Source =
  | { kind: "local" }
  | { kind: "ccs"; instance: string };

export type SessionStatus =
  | "working_tool"
  | "working_generating"
  | "waiting"
  | "stopped"
  | "inactive";

export type SessionCard = {
  id: string;
  source: Source;
  jsonlPath: string;
  hasSidecar: boolean;
  sidecarMtimeMs?: number;
  status: SessionStatus;
  projectPath: string;
  projectPathFromDir?: string;
  projectName: string;
  gitBranch?: string;
  model?: string;
  openedAt: number;
  lastActivityAt: number;
  messageCount: number;
  firstPrompt?: string;
  lastPrompt?: string;
  summary?: string;
  customTitle?: string;
  aiTitle?: string;
  lastEntryRole?: "user" | "assistant" | "system" | "attachment";
  lastStopReason?: string;
  lastToolName?: string;
  tokens?: { input: number; output: number; cacheRead: number };
};

export function sourceLabel(s: Source): string {
  return s.kind === "local" ? "local" : `ccs:${s.instance}`;
}
