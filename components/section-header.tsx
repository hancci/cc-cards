export function SectionHeader({
  index,
  label,
  count,
}: {
  index: number;
  label: string;
  count: number;
}) {
  const num = String(index).padStart(2, "0");
  return (
    <header className="flex items-baseline gap-4 pt-10 pb-2">
      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-faint)]">
        {num}
      </span>
      <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--color-ink)]">
        {label}
      </h2>
      <span className="text-[var(--color-faint)]">·</span>
      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
        {count}
      </span>
    </header>
  );
}
