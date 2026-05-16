import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";
import { focusProject } from "@/lib/focus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const cards = buildSnapshot();
  const card = cards.find((c) => c.id === id);
  if (!card) {
    return NextResponse.json(
      { ok: false, reason: "session not found" },
      { status: 404 },
    );
  }
  const result = focusProject(card.projectPath);
  return NextResponse.json(result);
}
