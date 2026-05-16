"use client";

import { useEffect } from "react";

export function CopyPathHandler() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const copyBtn = target?.closest("[data-copy]") as HTMLElement | null;
      const focusBtn = target?.closest("[data-focus]") as HTMLElement | null;
      if (!copyBtn && !focusBtn) return;

      // Capture-phase + stopImmediatePropagation prevents React's synthetic
      // event system from firing the surrounding <Link>'s navigation handler.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (copyBtn) {
        const path = copyBtn.dataset.copy;
        if (path && navigator.clipboard) {
          navigator.clipboard.writeText(path).then(() => flash(copyBtn, "copied ✓"));
        }
        return;
      }

      if (focusBtn) {
        const id = focusBtn.dataset.focus;
        if (!id) return;
        focusBtn.textContent = "focusing…";
        fetch(`/api/focus/${id}`, { method: "POST" })
          .then((r) => r.json())
          .then((data) => {
            if (data?.ok) {
              flash(focusBtn, `→ ${data.tmuxTarget ?? "focused"}`);
            } else {
              flash(focusBtn, `× ${data?.reason ?? "failed"}`);
            }
          })
          .catch(() => flash(focusBtn, "× error"));
      }
    };
    // capture: true → runs before React's delegated listeners at <html>.
    document.addEventListener("click", handler, { capture: true });
    return () =>
      document.removeEventListener("click", handler, { capture: true });
  }, []);
  return null;
}

function flash(btn: HTMLElement, msg: string) {
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => {
    btn.textContent = orig;
  }, 1500);
}
