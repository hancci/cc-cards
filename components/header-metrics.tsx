import type { HeaderMetrics } from "@/lib/metrics";

const ITEMS: Array<{ key: keyof HeaderMetrics; label: string }> = [
  { key: "active", label: "ACTIVE" },
  { key: "waiting", label: "WAITING" },
  { key: "today", label: "TODAY" },
  { key: "projects", label: "PROJECTS" },
  { key: "total", label: "TOTAL" },
];

export function HeaderMetricsBar({ metrics }: { metrics: HeaderMetrics }) {
  return (
    <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-[family-name:var(--font-mono)]">
      {ITEMS.map((it, i) => (
        <div key={it.key} className="flex items-baseline gap-2">
          <dt className="text-[10px] text-[var(--color-faint)] uppercase tracking-[0.18em]">
            {it.label}
          </dt>
          <dd className="text-[15px] text-[var(--color-ink)]">
            {metrics[it.key]}
          </dd>
          {i < ITEMS.length - 1 ? (
            <span className="text-[var(--color-faint)] ml-4">·</span>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
