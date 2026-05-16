import Link from "next/link";
import { buildSnapshot } from "@/lib/snapshot";
import { computeHeaderMetrics } from "@/lib/metrics";
import { FilterBar } from "@/components/filter-bar";
import { CopyPathHandler } from "@/components/copy-paths";
import { LiveSessionList } from "@/components/live-session-list";
import { Legend } from "@/components/legend";
import { HeaderMetricsBar } from "@/components/header-metrics";
import { DemoBanner } from "@/components/demo-banner";
import { isDemoFlag, maskCard } from "@/lib/masking";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ demo?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { demo } = await searchParams;
  const isDemo = isDemoFlag(demo);
  const rawCards = buildSnapshot();
  const allCards = isDemo ? rawCards.map(maskCard) : rawCards;
  const activeCards = allCards.filter((c) => c.status !== "inactive");
  const inactiveCount = allCards.length - activeCards.length;
  const metrics = computeHeaderMetrics(allCards);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-16 pb-32">
      <CopyPathHandler />
      <DemoBanner active={isDemo} />

      <header className="border-b border-[var(--color-rule)] pb-6">
        <h1 className="text-3xl tracking-tight text-[var(--color-ink)]">
          <em className="not-italic text-[var(--color-working-generating)]" style={{ fontStyle: "italic" }}>
            Claude Code
          </em>{" "}
          Sessions
        </h1>
        <HeaderMetricsBar metrics={metrics} />
      </header>

      <FilterBar mode="active" />

      <LiveSessionList initialCards={activeCards} mode="active" live={!isDemo} />

      <p className="mt-12 text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
        <Link
          href="/archive"
          className="text-[var(--color-link)] hover:underline"
        >
          비활성 세션 {inactiveCount}개 보기 →
        </Link>
      </p>

      <Legend />

      <footer className="pt-16 text-xs text-[var(--color-faint)] font-[family-name:var(--font-mono)]">
        cc-cards · localhost:3030
      </footer>
    </main>
  );
}
