import { NextResponse, type NextRequest } from "next/server";
import { bearerOk, scheduleStep, unauthorized } from "@/lib/chain";
import { env } from "@/lib/env";
import { activeRun, startRun } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** "Run now" from the dashboard: full ingest → score, protected by ADMIN_TOKEN. */
export async function POST(req: NextRequest) {
  if (!bearerOk(req, env.adminToken)) return unauthorized();
  if (!env.cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

  const running = await activeRun();
  if (running) return NextResponse.json({ error: "A run is already in progress", runId: running.id }, { status: 409 });

  const step = await startRun("full", "manual");
  scheduleStep(req.nextUrl.origin, step);
  return NextResponse.json({ accepted: true, runId: step.runId }, { status: 202 });
}
