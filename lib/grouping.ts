import type { SessionCard, SessionStatus } from "./types";
import { statusGroupLabel } from "./state";

export type SortKey =
  | "activity-desc"
  | "activity-asc"
  | "opened-desc"
  | "opened-asc";

export const ALL_STATUSES: SessionStatus[] = [
  "working_tool",
  "working_generating",
  "waiting",
  "stopped",
  "inactive",
];

export function parseStatusFilter(raw: string | undefined): Set<SessionStatus> {
  if (!raw) return new Set(ALL_STATUSES);
  const set = new Set<SessionStatus>();
  for (const s of raw.split(",")) {
    if ((ALL_STATUSES as string[]).includes(s)) set.add(s as SessionStatus);
  }
  return set.size === 0 ? new Set(ALL_STATUSES) : set;
}

export function parseSort(raw: string | undefined): SortKey {
  const v = raw as SortKey;
  if (v === "activity-asc" || v === "opened-asc" || v === "opened-desc") return v;
  return "activity-desc";
}

export function compareSessions(
  a: SessionCard,
  b: SessionCard,
  sort: SortKey,
): number {
  switch (sort) {
    case "activity-asc":
      return a.lastActivityAt - b.lastActivityAt;
    case "opened-asc":
      return a.openedAt - b.openedAt;
    case "opened-desc":
      return b.openedAt - a.openedAt;
    case "activity-desc":
    default:
      return b.lastActivityAt - a.lastActivityAt;
  }
}

export type Group = { key: string; label: string; cards: SessionCard[] };

export function groupSessions(
  cards: SessionCard[],
  groupBy: "status" | "project",
  sort: SortKey,
): Group[] {
  if (groupBy === "project") {
    const map = new Map<string, SessionCard[]>();
    for (const c of cards) {
      const k = c.projectName;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    const groups: Group[] = Array.from(map.entries()).map(([k, cs]) => ({
      key: k,
      label: k,
      cards: cs.sort((a, b) => compareSessions(a, b, sort)),
    }));
    groups.sort((a, b) => {
      const aRecent = Math.max(...a.cards.map((c) => c.lastActivityAt));
      const bRecent = Math.max(...b.cards.map((c) => c.lastActivityAt));
      return bRecent - aRecent;
    });
    return groups;
  }

  const order: SessionStatus[] = [
    "working_tool",
    "working_generating",
    "waiting",
    "stopped",
    "inactive",
  ];
  const map = new Map<SessionStatus, SessionCard[]>();
  for (const c of cards) {
    if (!map.has(c.status)) map.set(c.status, []);
    map.get(c.status)!.push(c);
  }
  return order
    .filter((s) => map.has(s))
    .map((s) => ({
      key: s,
      label: statusGroupLabel(s),
      cards: map.get(s)!.sort((a, b) => compareSessions(a, b, sort)),
    }));
}
