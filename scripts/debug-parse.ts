/* eslint-disable no-console */
import { discoverSources } from "../lib/sources";
import { scanSessions } from "../lib/scanner";
import { parseSession } from "../lib/parser";
import { readFileSync } from "node:fs";

const srcs = discoverSources();
const sessions = scanSessions(srcs[0]);
const recent = sessions.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 2);

for (const s of recent) {
  console.log(`\n=== ${s.sessionId} (${s.jsonlPath}) ===`);
  const head = readFileSync(s.jsonlPath, "utf8").split("\n").slice(0, 6);
  console.log("First 6 lines (truncated):");
  for (const l of head) {
    if (!l.trim()) continue;
    console.log("  " + l.slice(0, 200));
  }
  const card = parseSession(s);
  console.log("Parsed:");
  console.log({
    summary: card.summary,
    firstPrompt: card.firstPrompt,
    messageCount: card.messageCount,
    model: card.model,
    gitBranch: card.gitBranch,
    lastEntryRole: card.lastEntryRole,
    lastStopReason: card.lastStopReason,
    openedAt: new Date(card.openedAt).toISOString(),
  });
}
