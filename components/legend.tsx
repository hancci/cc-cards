type LegendItem = {
  key: string;
  label: string;
  color: string;
  desc: string;
};

const ITEMS: LegendItem[] = [
  {
    key: "working_tool",
    label: "도구 사용중",
    color: "var(--color-working-tool)",
    desc: "Claude가 도구 실행 결과를 기다리는 중입니다 (Bash, Read, Edit 등).",
  },
  {
    key: "working_generating",
    label: "응답중",
    color: "var(--color-working-generating)",
    desc: "사용자 메시지를 받고 Claude가 답변을 작성하는 중입니다.",
  },
  {
    key: "waiting",
    label: "대기",
    color: "var(--color-waiting)",
    desc: "Claude가 응답을 마쳤습니다. 다음 입력을 기다리는 상태입니다.",
  },
  {
    key: "stopped",
    label: "중단",
    color: "var(--color-stopped)",
    desc: "stop_sequence로 비정상 종료. 토큰 한도 또는 중단 토큰에 도달한 경우입니다.",
  },
  {
    key: "inactive",
    label: "비활성",
    color: "var(--color-inactive)",
    desc: "최근 활동이 없습니다. Claude 프로세스가 떠 있어도 5분 이상 유휴 상태입니다.",
  },
];

export function Legend() {
  return (
    <details className="mt-12 group">
      <summary
        className="
          cursor-pointer list-none
          text-xs font-[family-name:var(--font-mono)]
          text-[var(--color-faint)] hover:text-[var(--color-muted)]
          transition-colors
        "
      >
        <span className="group-open:hidden">▸ 상태 범례</span>
        <span className="hidden group-open:inline">▾ 상태 범례</span>
      </summary>
      <dl
        className="
          mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2
          text-xs font-[family-name:var(--font-mono)]
          text-[var(--color-muted)]
        "
      >
        {ITEMS.map((it) => (
          <div key={it.key} className="grid grid-cols-[3px_auto_1fr] gap-2 items-baseline">
            <span
              aria-hidden
              className="block self-stretch"
              style={{ background: it.color }}
            />
            <span style={{ color: it.color }} className="font-medium italic">
              {it.label}
            </span>
            <span className="text-[var(--color-muted)]">{it.desc}</span>
          </div>
        ))}
      </dl>
    </details>
  );
}
