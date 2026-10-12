/**
 * End-to-end verification against the brief, run on the live Supabase data.
 *
 *   npx tsx scripts/verify-e2e.ts [runId]
 *
 * Scores are recomputed here from the raw `signals` rows with an independent copy of the
 * brief's formula (not src/lib/scoring.ts), then compared with what the pipeline stored.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), {
  auth: { persistSession: false },
});

const W: Record<string, number> = {
  investment: 1.0, blog_post: 0.9, interview: 0.9, event: 0.8, social_post: 0.6, news_mention: 0.5, other: 0.3,
};
const DAY = 86_400_000;
const days = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY));
const rec = (a: number) => (a <= 30 ? 1 - 0.3 * (a / 30) : a <= 60 ? 0.4 - 0.3 * ((a - 30) / 30) : 0);
const NO_SIGNAL = "No observable signal in last 60 days";

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  const runId = process.argv[2];
  const runQ = db.from("runs").select("*").order("started_at", { ascending: false }).limit(1);
  const { data: runs } = runId ? await db.from("runs").select("*").eq("id", runId) : await runQ;
  const run = runs![0];
  const { data: vcs } = await db.from("vcs").select("*");
  const { data: sigs } = await db.from("signals").select("*");

  console.log(`\n== Run ${run.id} (${run.kind}, ${run.trigger})`);
  const fatal = ((run.errors ?? []) as { source: string; message: string }[]).filter((e) => e.source === "run");
  // "partial" = finished, with non-fatal source errors logged (e.g. GDELT throttling).
  check(["success", "partial"].includes(run.status) && fatal.length === 0, "run completed (no fatal error)",
    `status=${run.status}${fatal.length ? `; ${fatal.map((e) => e.message).join("; ")}` : ""}`);
  check(run.vcs_processed === 50, "all 50 VCs processed", `${run.vcs_processed}`);
  check(run.protected_check?.unchanged === true && run.protected_check.before_hash === run.protected_check.after_hash,
    "manual-column fingerprint identical before/after run", `${run.protected_check?.before_hash?.slice(0, 8)} = ${run.protected_check?.after_hash?.slice(0, 8)}`);
  const errs = (run.errors ?? []) as { source: string }[];
  const bySrc = errs.reduce<Record<string, number>>((m, e) => ((m[e.source] = (m[e.source] ?? 0) + 1), m), {});
  console.log(`      non-fatal source errors logged: ${errs.length} ${JSON.stringify(bySrc)}`);

  console.log(`\n== Live evidence`);
  const newThisRun = sigs!.filter((s) => Date.parse(s.discovered_at) >= Date.parse(run.started_at));
  console.log(`      signals total ${sigs!.length}, discovered in this run ${newThisRun.length}`);
  const srcCount = sigs!.reduce<Record<string, number>>((m, s) => ((m[s.source] = (m[s.source] ?? 0) + 1), m), {});
  console.log(`      by source ${JSON.stringify(srcCount)}`);
  const badUrl = sigs!.filter((s) => !/^https?:\/\/\S+$/.test(s.url));
  check(badUrl.length === 0, "every signal has a real http(s) URL", `${badUrl.length} bad`);
  const badDate = sigs!.filter((s) => !Number.isFinite(Date.parse(s.published_at)) || Date.parse(s.published_at) > Date.now() + DAY);
  check(badDate.length === 0, "every signal has a parseable, non-future published date", `${badDate.length} bad`);
  const keys = new Set<string>();
  const dupes = sigs!.filter((s) => { const k = `${s.vc_id}|${s.url}`; if (keys.has(k)) return true; keys.add(k); return false; });
  check(dupes.length === 0, "no duplicate (vc, url) evidence", `${dupes.length} dupes`);
  const unclassified = sigs!.filter((s) => s.is_about_vc === null);
  check(unclassified.length === 0, "every signal classified by Gemini", `${unclassified.length} pending`);
  const rejected = sigs!.filter((s) => s.is_about_vc === false).length;
  console.log(`      namesake/off-topic items rejected by the is_about_vc gate: ${rejected}`);

  console.log(`\n== Scores recomputed independently from raw signals`);
  // The score step ran close to the run's end; use its finish time as "now".
  const now = new Date(run.finished_at ?? Date.now());
  let exact = 0;
  const off: string[] = [];
  const bucketCount = { reach_out: 0, warm: 0, quiet: 0 };
  const bucketViolations: string[] = [];
  const lastDateMismatch: string[] = [];
  const summaryIssues: string[] = [];
  const actionIssues: string[] = [];

  for (const vc of vcs!) {
    const rel = sigs!.filter((s) => s.vc_id === vc.id && s.is_about_vc === true);
    const inWin = rel.map((s) => ({ s, age: days(s.published_at, now) })).filter((x) => x.age <= 60);
    const vals = inWin.map((x) => Math.min(1, Math.max(0, x.s.relevance ?? 0)) * (W[x.s.signal_type ?? "other"] ?? 0.3) * rec(x.age));
    const active = inWin.filter((x) => x.age <= 30).length;
    let base = vals.length ? Math.max(...vals) + Math.max(0, Math.min(0.15, 0.05 * (active - 1))) : 0;
    const ca = vc.last_contact_date ? days(vc.last_contact_date, now) : null;
    if (vc.contact_status === "passed") base = 0;
    else if (vc.contact_status === "waiting_for_response" && ca !== null && ca < 7) base = Math.min(base, 0.4);
    else if (vc.contact_status === "waiting_for_response" && ca !== null && ca >= 14 && active > 0) base += 0.1;
    const expected = Math.round(100 * Math.min(1, Math.max(0, base)));

    if (expected === vc.follow_up_score) exact++;
    else off.push(`${vc.name}: stored ${vc.follow_up_score} vs ${expected}`);

    const score = vc.follow_up_score ?? 0;
    const bucket = vc.contact_status === "passed" ? "quiet"
      : score >= 60 && active > 0 ? "reach_out"
      : score >= 25 || (active === 0 && inWin.length > 0 && score > 0) ? "warm" : "quiet";
    bucketCount[bucket]++;
    if (bucket === "reach_out" && active === 0) bucketViolations.push(`${vc.name} reach_out without active signal`);

    const newest = rel.map((s) => s.published_at).sort().at(-1);
    const expDate = newest ? new Date(newest).toISOString().slice(0, 10) : null;
    if (expDate !== vc.last_signal_date) lastDateMismatch.push(`${vc.name}: ${vc.last_signal_date} vs ${expDate}`);

    if (inWin.length === 0 && vc.signal_summary !== NO_SIGNAL) summaryIssues.push(`${vc.name}: quiet but summary="${vc.signal_summary}"`);
    if (inWin.length > 0 && !/^\d{1,2} [A-Z][a-z]{2,3}: /.test(vc.signal_summary ?? "")) summaryIssues.push(`${vc.name}: summary lacks a date`);

    const a = (vc.recommended_action ?? "").trim();
    const words = a.split(/\s+/).filter(Boolean).length;
    if (!a) actionIssues.push(`${vc.name}: empty action`);
    else if (words > 30) actionIssues.push(`${vc.name}: ${words} words`);
    if (/\b(he|she|his|her|him)\b/i.test(`${a} ${vc.signal_summary}`)) actionIssues.push(`${vc.name}: gendered pronoun`);
  }

  check(off.length === 0, "stored follow_up_score matches the brief's formula for all 50", `${exact}/50 exact${off.length ? "; " + off.join("; ") : ""}`);
  check(bucketViolations.length === 0, "'Reach out this week' only with a signal from the last 30 days", bucketViolations.join("; "));
  check(lastDateMismatch.length === 0, "last_signal_date = newest relevant signal", lastDateMismatch.join("; "));
  check(summaryIssues.length === 0, "signal_summary dated, or 'No observable signal…' when quiet", summaryIssues.slice(0, 5).join("; "));
  check(actionIssues.length === 0, "recommended_action present, ≤30 words, no gendered pronouns", actionIssues.slice(0, 5).join("; "));
  console.log(`      buckets: reach out ${bucketCount.reach_out} · warm ${bucketCount.warm} · quiet ${bucketCount.quiet}`);

  console.log(`\n== Database guardrails (as the pipeline's own service_role key)`);
  const nil = "00000000-0000-0000-0000-000000000000";
  for (const col of ["personal_notes", "contact_history", "contact_status", "last_contact_date", "name"]) {
    const { error } = await db.from("vcs").update({ [col]: col === "last_contact_date" ? "2026-01-01" : "x" }).eq("id", nil);
    check(!!error && /permission denied/i.test(error.message), `service_role cannot UPDATE vcs.${col}`, error?.message ?? "no error!");
  }
  const { error: okErr } = await db.from("vcs").update({ follow_up_score: 0 }).eq("id", nil);
  check(!okErr, "service_role may UPDATE a signal column (no rows touched)", okErr?.message ?? "");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
