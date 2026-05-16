/* eslint-disable no-console */
import { discoverSources } from "../lib/sources";
import { scanSessions } from "../lib/scanner";

const sources = discoverSources();
console.log("Discovered sources:");
for (const s of sources) {
  console.log(`  ${JSON.stringify(s.source)} root=${s.root}`);
  console.log(`    projectsDir=${s.projectsDir}`);
  const sessions = scanSessions(s);
  console.log(`    sessions=${sessions.length}`);
  if (sessions.length > 0) {
    console.log(`    first=${sessions[0].sessionId} :: ${sessions[0].projectPathFromDir}`);
  }
}
