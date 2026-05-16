import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const sessions = buildSnapshot();
  return NextResponse.json({ sessions, generatedAt: Date.now() });
}
