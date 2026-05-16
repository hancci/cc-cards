import { buildSnapshot, diffSnapshot } from "@/lib/snapshot";
import { startSnapshotWatcher } from "@/lib/watcher";
import type { SessionCard } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
// Short interval — picks up session terminations (claude exits without
// touching the JSONL, so fs.watch doesn't fire). buildSnapshot is warm-cached
// (~4ms when nothing changed) so this is cheap.
const FULL_REBUILD_INTERVAL_MS = 5_000;

export function GET(request: Request) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const activeOnly = scope !== "all";
  const snapshotOpts = { activeOnly };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let cards: SessionCard[] = [];

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        safeEnqueue(encoder.encode(payload));
      };

      const sendComment = (text: string) => {
        safeEnqueue(encoder.encode(`: ${text}\n\n`));
      };

      cards = buildSnapshot(snapshotOpts);
      send("snapshot", { sessions: cards, at: Date.now() });

      const stopWatcher = startSnapshotWatcher(({ changedPath, rootProjectsDir }) => {
        const { cards: next, patches } = diffSnapshot(
          cards,
          changedPath,
          rootProjectsDir,
          snapshotOpts,
        );
        cards = next;
        if (patches.length === 0) {
          send("snapshot", { sessions: cards, at: Date.now() });
        } else {
          for (const p of patches) send("patch", p);
        }
      });

      const heartbeat = setInterval(() => {
        sendComment(`hb ${Date.now()}`);
      }, HEARTBEAT_MS);

      const fullRebuild = setInterval(() => {
        cards = buildSnapshot(snapshotOpts);
        send("snapshot", { sessions: cards, at: Date.now() });
      }, FULL_REBUILD_INTERVAL_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(fullRebuild);
        try {
          stopWatcher();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
