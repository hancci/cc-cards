import type { SessionCard } from "./types";

export type HeaderMetrics = {
  active: number;       // working_tool + working_generating + waiting + stopped
  waiting: number;      // waiting + stopped (사용자 응답 차례)
  today: number;        // 오늘 openedAt
  projects: number;     // unique projectName (전체)
  total: number;        // 전체 세션 수
};

export function computeHeaderMetrics(cards: SessionCard[]): HeaderMetrics {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  let active = 0;
  let waiting = 0;
  let today = 0;
  const projects = new Set<string>();

  for (const c of cards) {
    projects.add(c.projectName);
    if (c.openedAt >= todayMs) today++;
    if (c.status !== "inactive") active++;
    if (c.status === "waiting" || c.status === "stopped") waiting++;
  }

  return {
    active,
    waiting,
    today,
    projects: projects.size,
    total: cards.length,
  };
}
