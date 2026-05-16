"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { SessionStatus } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";

const ACTIVE_STATUSES: SessionStatus[] = [
  "working_tool",
  "working_generating",
  "waiting",
  "stopped",
];
const ALL_STATUSES: SessionStatus[] = [...ACTIVE_STATUSES, "inactive"];

const STATUS_LABEL: Record<SessionStatus, string> = {
  working_tool: "도구 사용중",
  working_generating: "응답중",
  waiting: "대기",
  stopped: "중단",
  inactive: "비활성",
};

export type SortKey =
  | "activity-desc"
  | "activity-asc"
  | "opened-desc"
  | "opened-asc";

const SORT_LABEL: Record<SortKey, string> = {
  "activity-desc": "최근 활동순",
  "activity-asc": "오래된 활동순",
  "opened-desc": "최근 오픈순",
  "opened-asc": "오래된 오픈순",
};

const ALL_SORTS = Object.keys(SORT_LABEL) as SortKey[];

export function FilterBar({ mode = "all" }: { mode?: "active" | "all" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const visibleStatuses = mode === "active" ? ACTIVE_STATUSES : ALL_STATUSES;

  const selectedStatuses = useMemo<Set<SessionStatus>>(() => {
    const raw = sp.get("status");
    if (!raw) return new Set(visibleStatuses);
    return new Set(
      raw
        .split(",")
        .filter((s): s is SessionStatus => (visibleStatuses as string[]).includes(s)),
    );
  }, [sp, visibleStatuses]);

  const sort = (sp.get("sort") as SortKey) ?? "activity-desc";
  const group = sp.get("group") === "project";

  const pushQuery = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router],
  );

  const toggleStatus = (s: SessionStatus) => {
    const next = new URLSearchParams(sp.toString());
    const ns = new Set(selectedStatuses);
    if (ns.has(s)) ns.delete(s);
    else ns.add(s);
    if (ns.size === 0 || ns.size === visibleStatuses.length) {
      next.delete("status");
    } else {
      next.set("status", Array.from(ns).join(","));
    }
    pushQuery(next);
  };

  const setSort = (s: SortKey) => {
    const next = new URLSearchParams(sp.toString());
    if (s === "activity-desc") next.delete("sort");
    else next.set("sort", s);
    pushQuery(next);
  };

  const toggleGroup = () => {
    const next = new URLSearchParams(sp.toString());
    if (group) next.delete("group");
    else next.set("group", "project");
    pushQuery(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 text-xs text-[var(--color-muted)] font-[family-name:var(--font-mono)]">
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-faint)] uppercase tracking-wider">상태</span>
        {visibleStatuses.map((s) => {
          const on = selectedStatuses.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className="px-2 py-1 rounded transition-colors"
              style={{
                color: on ? "var(--color-ink)" : "var(--color-faint)",
                textDecoration: on ? "underline" : "none",
                textUnderlineOffset: "3px",
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2">
        <span className="text-[var(--color-faint)] uppercase tracking-wider">정렬</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-transparent text-[var(--color-ink)] underline underline-offset-[3px] decoration-[var(--color-faint)] cursor-pointer"
        >
          {ALL_SORTS.map((k) => (
            <option key={k} value={k} className="bg-white">
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={toggleGroup}
        className="flex items-center gap-2"
      >
        <span className="text-[var(--color-faint)] uppercase tracking-wider">그룹</span>
        <span
          style={{
            color: group ? "var(--color-ink)" : "var(--color-faint)",
            textDecoration: group ? "underline" : "none",
            textUnderlineOffset: "3px",
          }}
        >
          프로젝트별
        </span>
      </button>

      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </div>
  );
}
