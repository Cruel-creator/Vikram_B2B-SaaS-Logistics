import { loadRelevantSignals, loadVcs, mapLimit, newIngestCtx, ingestVc, scoreAndWrite, type RunError } from "./pipeline";
import { db, manualColumnsFingerprint } from "./supabase";
import type { RunRow } from "./types";

/**
 * Runs are processed as short steps (chunks of VCs), each returning the next cursor.
 * An invocation works through steps until its time budget is spent, then re-invokes
 * the route with the cursor (see chain.ts), so a full run needs only 2–3 invocations.
 */

export type Stage = "ingest" | "score";
export interface Step {
  runId: string;
  stage: Stage;
  offset: number;
}

// ~25–35 s per VC worst case (GDELT gate + 2–3 Gemini calls) → 5 VCs keeps each
// invocation well under Vercel's 300 s limit.
export const INGEST_CHUNK = 5;
export const SCORE_CHUNK = 25;
const MAX_STORED_ERRORS = 200;

export async function startRun(kind: RunRow["kind"], trigger: RunRow["trigger"]): Promise<Step> {
  const before = await manualColumnsFingerprint();
  const { count } = await db().from("vcs").select("id", { count: "exact", head: true });
  const stage: Stage = kind === "score" ? "score" : "ingest";
  const { data, error } = await db()
    .from("runs")
    .insert({
      kind,
      trigger,
      status: "running",
      stage,
      vcs_total: count ?? 0,
      protected_check: { before_hash: before },
    })
    .select("id")
    .single();
  if (error) throw new Error(`start run: ${error.message}`);
  return { runId: data.id, stage, offset: 0 };
}

export async function getRun(runId: string): Promise<RunRow> {
  const { data, error } = await db().from("runs").select("*").eq("id", runId).single();
  if (error) throw new Error(`get run: ${error.message}`);
  return data as RunRow;
}

/** Is another run already in progress (started in the last 20 min)? */
export async function activeRun(): Promise<RunRow | null> {
  const since = new Date(Date.now() - 20 * 60_000).toISOString();
  const { data } = await db()
    .from("runs")
    .select("*")
    .eq("status", "running")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1);
  return (data?.[0] as RunRow) ?? null;
}

async function patchRun(runId: string, patch: Partial<RunRow>) {
  const { error } = await db().from("runs").update(patch).eq("id", runId);
  if (error) throw new Error(`update run: ${error.message}`);
}

/** Execute one chunk. Returns the next step, or null when the run is finished. */
export async function runStep(step: Step): Promise<Step | null> {
  const run = await getRun(step.runId);
  if (run.status !== "running") return null;

  const vcs = await loadVcs();
  const size = step.stage === "ingest" ? INGEST_CHUNK : SCORE_CHUNK;
  const chunk = vcs.slice(step.offset, step.offset + size);
  const errors: RunError[] = [];
  let signalsNew = 0;
  let credits = 0;

  if (step.stage === "ingest") {
    const ctx = newIngestCtx();
    const counts = await mapLimit(chunk, 3, async (vc) => {
      try {
        return await ingestVc(vc, ctx);
      } catch (e) {
        ctx.errors.push({ at: new Date().toISOString(), vc: vc.name, source: "ingest", message: String((e as Error)?.message ?? e) });
        return 0;
      }
    });
    signalsNew = counts.reduce((a, b) => a + b, 0);
    errors.push(...ctx.errors);
    credits = ctx.credits;
  } else {
    const signals = await loadRelevantSignals(chunk.map((v) => v.id));
    await mapLimit(chunk, 2, async (vc) => {
      try {
        await scoreAndWrite(vc, signals.get(vc.id) ?? [], errors);
      } catch (e) {
        errors.push({ at: new Date().toISOString(), vc: vc.name, source: "score", message: String((e as Error)?.message ?? e) });
      }
    });
  }

  const nextOffset = step.offset + size;
  let next: Step | null = null;
  if (nextOffset < vcs.length) next = { ...step, offset: nextOffset };
  else if (step.stage === "ingest" && run.kind === "full") next = { runId: step.runId, stage: "score", offset: 0 };

  const countsVcs = step.stage === "ingest" || run.kind === "score";
  const fresh = await getRun(step.runId);
  await patchRun(step.runId, {
    vcs_processed: (fresh.vcs_processed ?? 0) + (countsVcs ? chunk.length : 0),
    signals_new: (fresh.signals_new ?? 0) + signalsNew,
    firecrawl_credits: (fresh.firecrawl_credits ?? 0) + credits,
    errors: [...(fresh.errors ?? []), ...errors].slice(-MAX_STORED_ERRORS),
    stage: next ? `${next.stage}:${next.offset}` : "finalizing",
  });

  if (!next) await finishRun(step.runId);
  return next;
}

export async function finishRun(runId: string, failure?: unknown) {
  const run = await getRun(runId);
  let after: string | undefined;
  try {
    after = await manualColumnsFingerprint();
  } catch {
    /* recorded as unknown below */
  }
  const before = run.protected_check?.before_hash;
  const errors = [...(run.errors ?? [])];
  if (failure) errors.push({ at: new Date().toISOString(), source: "run", message: String((failure as Error)?.message ?? failure) });
  await patchRun(runId, {
    finished_at: new Date().toISOString(),
    status: failure ? "failed" : errors.length > 0 ? "partial" : "success",
    stage: "done",
    errors: errors.slice(-MAX_STORED_ERRORS),
    protected_check: { before_hash: before, after_hash: after, unchanged: Boolean(before && after && before === after) },
  });
}

/** Run every step in-process (CLI / local testing — no serverless time limit). */
export async function runToCompletion(kind: RunRow["kind"], trigger: RunRow["trigger"], log = console.log): Promise<RunRow> {
  let step: Step | null = await startRun(kind, trigger);
  const runId = step.runId;
  try {
    while (step) {
      log(`→ ${step.stage} offset ${step.offset}`);
      step = await runStep(step);
    }
  } catch (e) {
    await finishRun(runId, e);
  }
  return getRun(runId);
}
