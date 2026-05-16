import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSnapshot } from "@/lib/snapshot";
import { findSessionCardById, getSessionDetail } from "@/lib/detail";
import { statusLabel } from "@/lib/state";
import { sourceLabel } from "@/lib/types";
import { compactNumber, formatAgo, isoLocal } from "@/lib/format";
import { TimelineView } from "@/components/timeline-view";

export const dynamic = "force-dynamic";

const STATUS_TEXT_COLOR = {
  working_tool: "text-[var(--color-working-tool)]",
  working_generating: "text-[var(--color-working-generating)]",
  waiting: "text-[var(--color-waiting)]",
  stopped: "text-[var(--color-stopped)]",
  inactive: "text-[var(--color-inactive)]",
} as const;

type Params = Promise<{ id: string }>;

export default async function SessionDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const snapshot = buildSnapshot();
  const card = findSessionCardById(id, snapshot);
  if (!card) notFound();

  const detail = getSessionDetail(card.jsonlPath, 300);

  const title = card.customTitle || card.summary || card.firstPrompt || "(untitled session)";

  return (
    <main className="mx-auto max-w-4xl px-6 pt-12 pb-32">
      <nav className="mb-6">
        <Link
          href="/"
          className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-link)] hover:underline"
        >
          ← back to all sessions
        </Link>
      </nav>

      <header className="border-b border-[var(--color-rule)] pb-6">
        <div className="flex items-center gap-3 text-sm">
          <em
            className={`${STATUS_TEXT_COLOR[card.status]} not-italic`}
            style={{ fontStyle: "italic", fontWeight: 500 }}
          >
            {statusLabel(card.status)}
          </em>
          <span className="text-[var(--color-faint)]">·</span>
          <span className="font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
            {card.projectName}
          </span>
          {card.gitBranch ? (
            <>
              <span className="text-[var(--color-faint)]">·</span>
              <span className="font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
                ⌥ {card.gitBranch}
              </span>
            </>
          ) : null}
          <span className="text-[var(--color-faint)]">·</span>
          <span className="font-[family-name:var(--font-mono)] text-[var(--color-faint)]">
            {sourceLabel(card.source)}
          </span>
        </div>

        {card.customTitle ? (
          <div
            className="
              mt-3 inline-flex items-center
              border border-[var(--color-cyan)]
              text-[var(--color-cyan)]
              bg-[var(--color-cyan-bg)]
              font-[family-name:var(--font-mono)]
              text-xs tracking-tight
              px-2 py-1
            "
          >
            {card.customTitle}
          </div>
        ) : null}

        <h1 className="mt-2 text-2xl leading-snug text-[var(--color-ink)]">{title}</h1>

        <dl className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
          {card.model ? <span>{card.model.replace(/^claude-/, "")}</span> : null}
          <Sep />
          <span>{compactNumber(card.messageCount)} msgs</span>
          <Sep />
          <span title={isoLocal(card.openedAt)}>opened {formatAgo(card.openedAt)}</span>
          <Sep />
          <span title={isoLocal(card.lastActivityAt)}>
            last {formatAgo(card.lastActivityAt)}
          </span>
        </dl>

        <p className="mt-3 text-[11px] font-[family-name:var(--font-mono)] text-[var(--color-faint)] break-all">
          {card.jsonlPath}
        </p>
      </header>

      {detail ? (
        <>
          <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-[family-name:var(--font-mono)]">
            <Stat label="user msgs" value={detail.stats.userCount} />
            <Stat label="assistant" value={detail.stats.assistantCount} />
            <Stat label="meta entries" value={detail.stats.metaCount} />
            <Stat
              label="duration"
              value={formatDuration(detail.stats.durationMs)}
            />
            <Stat
              label="tokens in"
              value={compactNumber(detail.stats.totalInputTokens)}
            />
            <Stat
              label="tokens out"
              value={compactNumber(detail.stats.totalOutputTokens)}
            />
            <Stat
              label="cache read"
              value={compactNumber(detail.stats.totalCacheRead)}
            />
            <Stat
              label="unique tools"
              value={Object.keys(detail.stats.toolUsage).length}
            />
          </section>

          {Object.keys(detail.stats.toolUsage).length > 0 ? (
            <section className="mt-4 text-xs font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
              <span className="text-[var(--color-faint)] uppercase tracking-wider">
                tools:
              </span>{" "}
              {Object.entries(detail.stats.toolUsage)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v], i) => (
                  <span key={k}>
                    {i === 0 ? "" : <span className="text-[var(--color-faint)]"> · </span>}
                    <span className="text-[var(--color-ink)]">{k}</span>
                    <span className="text-[var(--color-faint)]"> {v}</span>
                  </span>
                ))}
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-ink)] mb-3">
              Timeline
              <span className="text-[var(--color-faint)]"> · </span>
              <span className="text-[var(--color-muted)]">
                {detail.entries.length}
                {detail.truncated ? ` of ${detail.totalEntries}` : ""}
              </span>
            </h2>
            <TimelineView entries={detail.entries} />
          </section>
        </>
      ) : (
        <p className="mt-8 text-sm text-[var(--color-muted)]">
          session JSONL too large or unreadable to load timeline.
        </p>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] rounded px-3 py-2">
      <div className="text-[10px] text-[var(--color-faint)] uppercase tracking-wider">
        {label}
      </div>
      <div className="text-base text-[var(--color-ink)] mt-1">{value}</div>
    </div>
  );
}

function Sep() {
  return <span className="text-[var(--color-faint)]">·</span>;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
