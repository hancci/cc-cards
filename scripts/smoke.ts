/* eslint-disable no-console */
import { buildSnapshot } from "../lib/snapshot";
import { sourceLabel } from "../lib/types";

const all = buildSnapshot();
const bySource = new Map<string, number>();
const byStatus = new Map<string, number>();
for (const c of all) {
  const sk = sourceLabel(c.source);
  bySource.set(sk, (bySource.get(sk) ?? 0) + 1);
  byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
}

console.log(`Total sessions: ${all.length}`);
console.log("By source:");
for (const [k, v] of bySource) console.log(`  ${k}: ${v}`);
console.log("By status:");
for (const [k, v] of byStatus) console.log(`  ${k}: ${v}`);

console.log("\nTop 5 most recent:");
for (const c of all.slice(0, 5)) {
  console.log(
    `  [${c.status.padEnd(8)}] ${sourceLabel(c.source).padEnd(12)} ${c.projectName} :: ${(c.summary ?? c.firstPrompt ?? "").slice(0, 80)}`,
  );
  console.log(
    `      model=${c.model ?? "?"} msgs=${c.messageCount} branch=${c.gitBranch ?? "?"} role=${c.lastEntryRole ?? "?"} stop=${c.lastStopReason ?? "?"} tool=${c.lastToolName ?? "?"}`,
  );
}
