import type { SessionCard, SessionStatus } from "./types";

const WORKING_WINDOW_MS = 15 * 1000;
// Even with a live claude process matched to this session's project, a
// user-tail session that has been idle for longer than this is more likely
// to be a stale top-N match in `recomputeStatuses` than an actual active
// generation — humans don't wait this long for a reply, they cancel.
const WORKING_LIVE_WINDOW_MS = 5 * 60 * 1000;
const WAITING_LIVE_WINDOW_MS = 5 * 60 * 1000;
const WAITING_WINDOW_MS = 30 * 60 * 1000;
const STOPPED_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ClassifyContext = {
  isThisLive?: boolean;
  livenessOk?: boolean;
};

export function classifyStatus(
  card: SessionCard,
  now = Date.now(),
  ctx?: ClassifyContext,
): SessionStatus {
  const age = now - card.lastActivityAt;
  const haveLiveness = ctx?.livenessOk === true;
  const isLive = ctx?.isThisLive ?? !haveLiveness;

  // Dead session — claude process is gone. The session is over regardless of
  // what stop_reason it last carried. Skip "stopped" too: a closed window with
  // a stale stop_sequence is just history.
  if (haveLiveness && !isLive) return "inactive";

  // Stopped — abnormal stop_reason while claude is still up. Surfaces the
  // hang/limit case so the user can notice it and act.
  if (
    card.lastStopReason === "stop_sequence" &&
    age < STOPPED_WINDOW_MS
  ) {
    return "stopped";
  }

  // 1. Tool execution in progress.
  //    Mtime moving = claude is writing. Or, while claude is alive, a
  //    tool_use stop_reason means it's parked mid-tool-call.
  if (
    age < WORKING_WINDOW_MS &&
    card.lastStopReason === "tool_use"
  ) {
    return "working_tool";
  }
  if (
    haveLiveness &&
    isLive &&
    card.lastStopReason === "tool_use" &&
    age < WORKING_LIVE_WINDOW_MS
  ) {
    return "working_tool";
  }

  // 2. Generating — user message is the latest entry and claude hasn't
  //    written its reply yet. 15s-mtime rule keeps stale generating cards
  //    from sticking around when liveness data is unavailable.
  if (
    age < WORKING_WINDOW_MS &&
    (card.lastEntryRole === "user" || card.lastEntryRole === undefined)
  ) {
    return "working_generating";
  }
  if (
    haveLiveness &&
    isLive &&
    card.lastEntryRole === "user" &&
    age < WORKING_LIVE_WINDOW_MS
  ) {
    return "working_generating";
  }

  // 3. Waiting — claude process for this session is alive, and we already
  //    failed the "actively generating" tests above. The conversation is
  //    parked: maybe at end_turn ready for the next prompt, maybe paused on
  //    a tool_use (ExitPlanMode awaiting approval), maybe abandoned with a
  //    user message that never got answered. All three are reachable —
  //    user can click `focus →` to jump into the tmux pane — so surface
  //    them as "waiting" rather than burying them in the archive.
  if (haveLiveness && isLive) return "waiting";

  // Without liveness data, fall back to the narrow disk-only signal:
  // assistant ended cleanly within the last 30 min.
  if (
    !haveLiveness &&
    card.lastEntryRole === "assistant" &&
    (card.lastStopReason === "end_turn" || card.lastStopReason === undefined) &&
    age < WAITING_WINDOW_MS
  ) {
    return "waiting";
  }

  return "inactive";
}

export function statusLabel(s: SessionStatus): string {
  switch (s) {
    case "working_tool":
      return "도구 사용중";
    case "working_generating":
      return "응답중";
    case "waiting":
      return "대기";
    case "stopped":
      return "중단";
    case "inactive":
      return "비활성";
  }
}

export function statusGroupLabel(s: SessionStatus): string {
  switch (s) {
    case "working_tool":
      return "TOOL";
    case "working_generating":
      return "GENERATING";
    case "waiting":
      return "WAITING";
    case "stopped":
      return "STOPPED";
    case "inactive":
      return "INACTIVE";
  }
}

export function isActiveStatus(s: SessionStatus): boolean {
  return s !== "inactive";
}
