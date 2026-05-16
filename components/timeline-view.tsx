import type { TimelineEntry } from "@/lib/detail";
import { isoLocal } from "@/lib/format";
import { MarkdownView } from "@/components/markdown-view";

const ROLE_STYLES = {
  user: {
    label: "USER",
    color: "var(--color-link)",
    bg: "transparent",
  },
  assistant: {
    label: "ASSISTANT",
    color: "var(--color-working)",
    bg: "transparent",
  },
  system: {
    label: "SYSTEM",
    color: "var(--color-faint)",
    bg: "transparent",
  },
  meta: {
    label: "META",
    color: "var(--color-faint)",
    bg: "transparent",
  },
} as const;

export function TimelineView({
  entries,
  showMeta = false,
}: {
  entries: TimelineEntry[];
  showMeta?: boolean;
}) {
  const filtered = showMeta ? entries : entries.filter((e) => e.role !== "meta");
  if (filtered.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-muted)]">
        no entries.
      </p>
    );
  }

  // Render reverse chronological (latest first)
  const reversed = [...filtered].reverse();

  return (
    <ol className="space-y-3">
      {reversed.map((e) => (
        <li key={e.index}>
          <TimelineRow entry={e} />
        </li>
      ))}
    </ol>
  );
}

function TimelineRow({ entry: e }: { entry: TimelineEntry }) {
  const style = ROLE_STYLES[e.role];
  return (
    <article
      className="
        rounded border border-[var(--color-rule)] bg-[var(--color-paper)]
        overflow-hidden
      "
    >
      <header
        className="
          flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1
          px-3 py-1.5
          bg-[var(--color-card-header)] border-b border-[var(--color-rule)]
          text-[11px] font-[family-name:var(--font-mono)]
        "
      >
        <span className="flex items-center gap-2">
          <span style={{ color: style.color }} className="font-medium tracking-wider">
            {style.label}
          </span>
          {e.model ? (
            <span className="text-[var(--color-faint)]">{e.model.replace(/^claude-/, "")}</span>
          ) : null}
          {e.stopReason ? (
            <span className="text-[var(--color-muted)]">· {e.stopReason}</span>
          ) : null}
          {e.toolName ? (
            <span className="text-[var(--color-cyan)]">· {e.toolName}</span>
          ) : null}
        </span>
        <span className="text-[var(--color-faint)]">
          {e.ts ? isoLocal(e.ts) : "—"}
        </span>
      </header>

      {e.text ? (
        <div className="px-3 py-2 max-h-[28rem] overflow-auto">
          <MarkdownView text={e.text} />
        </div>
      ) : null}

      {e.toolInput ? (
        <details className="border-t border-[var(--color-rule)]">
          <summary className="cursor-pointer px-3 py-1 text-[11px] font-[family-name:var(--font-mono)] text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            tool input
          </summary>
          <pre className="px-3 py-2 text-[11px] font-[family-name:var(--font-mono)] text-[var(--color-muted)] whitespace-pre-wrap max-h-48 overflow-auto bg-[var(--color-card-footer)]">
            {e.toolInput}
          </pre>
        </details>
      ) : null}

      {e.tokens ? (
        <footer className="px-3 py-1 border-t border-[var(--color-rule)] bg-[var(--color-card-footer)] text-[11px] font-[family-name:var(--font-mono)] text-[var(--color-muted)] flex gap-3">
          <span>in {e.tokens.input}</span>
          <span>out {e.tokens.output}</span>
          {e.tokens.cacheRead > 0 ? <span>cache {e.tokens.cacheRead}</span> : null}
        </footer>
      ) : null}
    </article>
  );
}
