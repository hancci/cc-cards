import Link from "next/link";
import { buildSnapshot } from "@/lib/snapshot";
import { FilterBar } from "@/components/filter-bar";
import { CopyPathHandler } from "@/components/copy-paths";
import { LiveSessionList } from "@/components/live-session-list";
import { Legend } from "@/components/legend";
import { DemoBanner } from "@/components/demo-banner";
import { isDemoFlag, maskCard } from "@/lib/masking";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ demo?: string | string[] }>;

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { demo } = await searchParams;
  const isDemo = isDemoFlag(demo);
  const rawCards = buildSnapshot();
  const allCards = isDemo ? rawCards.map(maskCard) : rawCards;

  return (
    <main className="mx-auto max-w-7xl px-6 pt-16 pb-32">
      <CopyPathHandler />
      <DemoBanner active={isDemo} />

      <nav className="mb-4">
        <Link
          href="/"
          className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-link)] hover:underline"
        >
          ← back to live sessions
        </Link>
      </nav>

      <header className="border-b border-[var(--color-rule)] pb-6">
        <h1 className="text-3xl tracking-tight text-[var(--color-ink)]">
          <em className="text-[var(--color-faint)]">Archive</em>
          <span className="text-[var(--color-muted)]"> · all sessions</span>
        </h1>
        <p className="mt-3 text-xs text-[var(--color-muted)] font-[family-name:var(--font-mono)]">
          {allCards.length} sessions across local and ccs instances
        </p>
      </header>

      <FilterBar mode="all" />

      <LiveSessionList initialCards={allCards} mode="all" live={!isDemo} />

      <Legend />
    </main>
  );
}
