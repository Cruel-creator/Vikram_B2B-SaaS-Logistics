import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { env } from "./env";
import { finishRun, runStep, startRun, type Stage, type Step } from "./runs";
import type { RunRow } from "./types";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Bearer-token check. A missing secret on the server always rejects (fail closed). */
export function bearerOk(req: NextRequest, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && safeEqual(token, secret);
}

export const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

/** Fire the next chunk as its own invocation (each gets a fresh 300 s budget). */
export async function kick(origin: string, step: Step) {
  const url = `${origin}/api/cron/${step.stage}?run=${step.runId}&offset=${step.offset}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.cronSecret}` },
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`chain kick ${res.status} for ${step.stage}@${step.offset}`);
}

/** Process one step after the response is sent, then hand off to the next invocation. */
export function scheduleStep(origin: string, step: Step) {
  after(async () => {
    try {
      const next = await runStep(step);
      if (next) await kick(origin, next);
    } catch (e) {
      console.error("[pipeline] step failed", step, e);
      await finishRun(step.runId, e).catch(() => {});
    }
  });
}

/** Shared handler for /api/cron/ingest and /api/cron/score. */
export async function handleCron(req: NextRequest, stage: Stage, kindIfNew: RunRow["kind"]) {
  if (!bearerOk(req, env.cronSecret)) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const origin = req.nextUrl.origin;

  let step: Step;
  const runId = sp.get("run");
  if (runId) {
    step = { runId, stage, offset: Math.max(0, Number(sp.get("offset") ?? 0) || 0) };
  } else {
    step = await startRun(kindIfNew, "cron");
  }
  scheduleStep(origin, step);
  return NextResponse.json({ accepted: true, ...step }, { status: 202 });
}
