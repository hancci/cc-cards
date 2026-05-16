"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const LABEL: Record<Theme, string> = {
  light: "라이트",
  dark: "다크",
};

function readStored(): Theme {
  if (typeof window === "undefined") return "light";
  const s = window.localStorage.getItem("theme");
  return s === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStored());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    apply(theme);
    try {
      window.localStorage.setItem("theme", theme);
    } catch {
      // ignore storage failures
    }
  }, [theme, mounted]);

  const toggle = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2"
      suppressHydrationWarning
      aria-label={`Theme: ${LABEL[theme]} (click to toggle)`}
    >
      <span className="text-[var(--color-faint)] uppercase tracking-wider">테마</span>
      <span
        className="underline underline-offset-[3px] decoration-[var(--color-faint)]"
        style={{ color: "var(--color-ink)" }}
      >
        {LABEL[theme]}
      </span>
    </button>
  );
}

// Pre-paint inline script: read stored theme (default light) and set the
// attribute synchronously before first paint. No "system" fallback — auto mode
// is intentionally removed because the toggle only has two states.
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  if (t !== 'dark' && t !== 'light') t = 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'light');
}
`;
