"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SessionCardItem } from "@/components/session-card";
import { SectionHeader } from "@/components/section-header";
import type { SessionCard } from "@/lib/types";
import { sourceLabel } from "@/lib/types";
import {
  ALL_STATUSES,
  groupSessions,
  parseSort,
  parseStatusFilter,
} from "@/lib/grouping";

type Props = {
  initialCards: SessionCard[];
  mode?: "active" | "all";
  live?: boolean;
};

export function LiveSessionList({ initialCards, mode = "all", live = true }: Props) {
  const [cards, setCards] = useState<SessionCard[]>(initialCards);
  const [connected, setConnected] = useState(false);
  const sp = useSearchParams();

  useEffect(() => {
    if (!live) return;
    const url = mode === "active" ? "/api/stream?scope=active" : "/api/stream?scope=all";
    const es = new EventSource(url);
    es.addEventListener("snapshot", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          sessions: SessionCard[];
        };
        setCards(payload.sessions);
      } catch {
        // ignore malformed events
      }
    });
    es.addEventListener("patch", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as
          | { kind: "upsert"; card: SessionCard }
          | { kind: "remove"; id: string };
        setCards((prev) => {
          if (payload.kind === "remove") {
            return prev.filter((c) => c.id !== payload.id);
          }
          const next = prev.slice();
          const idx = next.findIndex((c) => c.id === payload.card.id);
          if (idx >= 0) next[idx] = payload.card;
          else next.push(payload.card);
          next.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
          return next;
        });
      } catch {
        // ignore malformed events
      }
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [mode, live]);

  const statusFilter = useMemo(
    () => parseStatusFilter(sp.get("status") ?? undefined),
    [sp],
  );
  const sort = useMemo(() => parseSort(sp.get("sort") ?? undefined), [sp]);
  const groupBy = sp.get("group") === "project" ? "project" : "status";

  const filtered = cards.filter((c) => statusFilter.has(c.status));
  const grouped = groupSessions(filtered, groupBy, sort);

  const totalSources = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) {
      const k = sourceLabel(c.source);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ");
  }, [cards]);

  return (
    <>
      <p
        className="-mt-2 text-sm text-[var(--color-muted)] font-[family-name:var(--font-mono)] flex items-center gap-2"
        suppressHydrationWarning
      >
        {cards.length} sessions
        {totalSources ? (
          <>
            <span className="text-[var(--color-faint)]">·</span>
            <span>{totalSources}</span>
          </>
        ) : null}
        <span
          aria-label={connected ? "live" : "reconnecting"}
          className="inline-block w-1.5 h-1.5 rounded-full ml-1"
          style={{
            background: connected ? "var(--color-waiting)" : "var(--color-faint)",
            transition: "background 200ms",
          }}
        />
      </p>

      <section className="mt-2">
        {grouped.length === 0 ? (
          <p className="py-20 text-center text-[var(--color-muted)] text-sm">
            no sessions match the current filter.
          </p>
        ) : (
          grouped.map((g, i) => (
            <div key={g.key}>
              <SectionHeader index={i + 1} label={g.label} count={g.cards.length} />
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {g.cards.map((c) => (
                  <SessionCardItem key={c.id} card={c} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <span hidden>{ALL_STATUSES.length}</span>
    </>
  );
}
