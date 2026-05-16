import Link from "next/link";

export function DemoBanner({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="
        mb-4 flex items-center justify-between gap-3
        rounded-md border border-[var(--color-cyan)]
        bg-[var(--color-cyan-bg)]
        px-3 py-2
        text-[12px] font-[family-name:var(--font-mono)]
        text-[var(--color-cyan)]
      "
    >
      <span>
        <span className="font-bold">DEMO MODE</span>
        <span className="text-[var(--color-muted)]">
          {" "}
          · project / branch / prompts replaced with placeholders. screenshot-safe.
        </span>
      </span>
      <Link
        href="?"
        className="text-[var(--color-cyan)] hover:underline shrink-0"
      >
        turn off →
      </Link>
    </div>
  );
}
