import Link from "next/link";
import { sourceLabel, type SessionCard as TSessionCard } from "@/lib/types";
import { statusLabel } from "@/lib/state";
import { formatAgo, shortTime, compactNumber, isoLocal, cleanPrompt } from "@/lib/format";

const RAIL_COLOR: Record<TSessionCard["status"], string> = {
  working_tool: "var(--color-working-tool)",
  working_generating: "var(--color-working-generating)",
  waiting: "var(--color-waiting)",
  stopped: "var(--color-stopped)",
  inactive: "var(--color-inactive)",
};

const STATUS_TEXT_COLOR: Record<TSessionCard["status"], string> = {
  working_tool: "text-[var(--color-working-tool)]",
  working_generating: "text-[var(--color-working-generating)]",
  waiting: "text-[var(--color-waiting)]",
  stopped: "text-[var(--color-stopped)]",
  inactive: "text-[var(--color-inactive)]",
};

export function SessionCardItem({ card }: { card: TSessionCard }) {
  // Two-line body:
  //   title line: summary (preferred) or firstPrompt — session identity
  //   now line:   "↳ now: <lastPrompt>" — only when meaningfully different
  const titleLine = card.summary ?? cleanPrompt(card.firstPrompt);
  const nowLine = cleanPrompt(card.lastPrompt);
  const nowDiffers = !!nowLine && nowLine !== titleLine;
  const showBody = !!titleLine || !card.customTitle;
  const title = titleLine ?? "(메시지 없음)";
  const openedAgo = formatAgo(card.openedAt);
  const lastAgo = formatAgo(card.lastActivityAt);
  const last = shortTime(card.lastActivityAt);
  const lastAction = card.lastToolName
    ? `${card.lastToolName}${card.lastStopReason ? ` (${card.lastStopReason})` : ""}`
    : card.lastStopReason ?? "";

  return (
    <Link
      href={`/session/${card.id}`}
      className="
        group relative block overflow-hidden
        rounded-lg
        border border-[var(--color-rule)]
        bg-[var(--color-surface)]
        transition-all duration-150
        hover:border-[var(--color-rule-hover)]
        hover:shadow-[0_1px_2px_rgba(89,72,38,0.06),0_4px_12px_rgba(89,72,38,0.05)]
      "
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px] z-10"
        style={{ background: RAIL_COLOR[card.status] }}
      />

      {/* Header panel — sandy bg, like an illustration strip */}
      <header
        className="
          flex items-center justify-between gap-3
          pl-5 pr-4 py-2.5
          bg-[var(--color-card-header)]
          border-b border-[var(--color-rule)]
        "
      >
        <em
          className={`${STATUS_TEXT_COLOR[card.status]} not-italic text-xs`}
          style={{ fontStyle: "italic", fontWeight: 500 }}
        >
          {statusLabel(card.status)}
        </em>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-muted)] truncate">
          {card.projectName}
          {card.gitBranch ? (
            <>
              {" "}
              <span className="text-[var(--color-faint)]">·</span>{" "}
              <span>⌥ {card.gitBranch}</span>
            </>
          ) : null}
        </span>
      </header>

      {/* Body — white card content */}
      <section className="pl-5 pr-4 py-3 bg-[var(--color-surface)]">
        {card.customTitle ? (
          <div
            className="
              mb-2 inline-flex items-center
              border border-[var(--color-cyan)]
              bg-[var(--color-cyan-bg)]
              text-[var(--color-cyan)]
              font-[family-name:var(--font-mono)]
              font-bold
              text-[13px] tracking-tight
              px-2 py-[3px] rounded-sm
            "
            title="/rename session title"
          >
            {card.customTitle}
          </div>
        ) : card.aiTitle ? (
          <div
            className="
              mb-2 inline-flex items-center
              border border-[var(--color-rule)]
              text-[var(--color-muted)]
              font-[family-name:var(--font-mono)]
              text-[12px] tracking-tight
              px-2 py-[2px] rounded-sm
            "
            title="auto-generated session title"
          >
            {card.aiTitle}
          </div>
        ) : null}

        {showBody ? (
          <p className="text-[14px] leading-relaxed text-[var(--color-ink)] line-clamp-2">
            {title}
          </p>
        ) : null}
        {nowDiffers ? (
          <p className="mt-1.5 text-[12.5px] leading-snug text-[var(--color-muted)] line-clamp-1">
            <span className="text-[var(--color-faint)]">↳ now:</span> {nowLine}
          </p>
        ) : null}

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-[family-name:var(--font-mono)] text-[var(--color-muted)]">
          {card.model ? <span>{card.model.replace(/^claude-/, "")}</span> : null}
          {card.model ? <Sep /> : null}
          <span>{compactNumber(card.messageCount)} msgs</span>
          <Sep />
          <span title={isoLocal(card.openedAt)} suppressHydrationWarning>
            opened {openedAgo}
          </span>
          <Sep />
          <span title={isoLocal(card.lastActivityAt)} suppressHydrationWarning>
            {lastAgo} · {last}
          </span>
        </p>
      </section>

      {/* Footer — mono strip, like the .html filename in the reference */}
      <footer
        className="
          flex items-center gap-3
          pl-5 pr-4 py-2
          bg-[var(--color-card-footer)]
          border-t border-[var(--color-rule)]
          text-[11px] font-[family-name:var(--font-mono)] text-[var(--color-muted)]
        "
      >
        {lastAction ? (
          <>
            <span className="text-[var(--color-faint)]">↳ last:</span>
            <span className="truncate">{lastAction}</span>
          </>
        ) : (
          <span className="text-[var(--color-faint)] truncate">{card.id.slice(0, 8)}…</span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[var(--color-faint)]">{sourceLabel(card.source)}</span>
          <button
            type="button"
            data-focus={card.id}
            className="
              focus-pane
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              text-[var(--color-link)] hover:underline
            "
            aria-label="Focus tmux pane"
          >
            focus →
          </button>
          <button
            type="button"
            data-copy={card.jsonlPath}
            className="
              copy-path
              opacity-0 group-hover:opacity-100
              transition-opacity duration-150
              text-[var(--color-link)] hover:underline
            "
            aria-label="Copy JSONL path"
          >
            copy →
          </button>
        </span>
      </footer>
    </Link>
  );
}

function Sep() {
  return <span className="text-[var(--color-faint)]">·</span>;
}
