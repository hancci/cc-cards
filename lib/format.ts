export function formatAgo(ts: number, now = Date.now()): string {
  const diff = now - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  const restMin = min % 60;
  if (hr < 24) return restMin === 0 ? `${hr}h ago` : `${hr}h ${restMin}m ago`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * Strip Claude Code meta-tag wrappers from a raw user message so a card body
 * shows the actual prompt instead of slash-command boilerplate.
 *
 * Removes pairs like:
 *   <local-command-caveat>...</local-command-caveat>
 *   <local-command-stdout>...</local-command-stdout>
 *   <command-name>...</command-name>
 *   <command-message>...</command-message>
 *   <command-args>...</command-args>
 *   <system-reminder>...</system-reminder>
 * and collapses surrounding whitespace.
 */
const META_TAG_NAMES =
  "(?:local-command-(?:caveat|stdout|stderr|args)|command-(?:name|message|args)|system-reminder|bash-(?:input|stdout|stderr))";
const META_TAG_RE = new RegExp(
  `<${META_TAG_NAMES}\\b[^>]*>[\\s\\S]*?<\\/${META_TAG_NAMES}>`,
  "gi",
);
const UNCLOSED_META_RE = new RegExp(
  `<${META_TAG_NAMES}\\b[^>]*>[\\s\\S]*$`,
  "i",
);

export function cleanPrompt(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const stripped = raw
    .replace(META_TAG_RE, " ")
    .replace(UNCLOSED_META_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : null;
}

export function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
