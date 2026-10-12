import { env } from "./env";
import { classifyCandidates, CLASSIFY_BATCH, recommendAction, templateAction } from "./gemini";
import { ageInDays, buildSignalSummary, scoreVc, type ScoreSignal } from "./scoring";
import { firecrawlPerson } from "./sources/firecrawl";
import { gdeltPerson } from "./sources/gdelt";
import { googleNewsFirm, googleNewsPerson } from "./sources/googleNews";
import { linkedinEnabled, linkedinPosts } from "./sources/linkedin";
import { blogRss } from "./sources/rss";
import { md5, withinDays } from "./sources/util";
import { db } from "./supabase";
import type { Bucket, Candidate, Vc } from "./types";

export type RunError = { at: string; vc?: string; source?: string; message: string };

export interface IngestCtx {
  firmCache: Map<string, Promise<Candidate[]>>;
  errors: RunError[];
  credits: number;
}

export const newIngestCtx = (): IngestCtx => ({ firmCache: new Map(), errors: [], credits: 0 });

const MAX_CANDIDATES_PER_VC = 24;
const MAX_FIRM_CANDIDATES = 8;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function loadVcs(): Promise<Vc[]> {
  const { data, error } = await db().from("vcs").select("*").order("firm").order("name");
  if (error) throw new Error(`load vcs: ${error.message}`);
  return (data ?? []) as Vc[];
}

/** Map over items with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function dedupe(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return cands.filter((c) => {
    const k = md5(c.url);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Classify in batches of 8 and store every classified candidate (including rejects, for audit + dedupe). */
async function classifyAndStore(vc: Vc, fresh: Candidate[], ctx: IngestCtx): Promise<{ inserted: number; activeAbout: number }> {
  let inserted = 0;
  let activeAbout = 0;
  for (let i = 0; i < fresh.length; i += CLASSIFY_BATCH) {
    const batch = fresh.slice(i, i + CLASSIFY_BATCH);
    let labels;
    try {
      labels = await classifyCandidates(vc, batch);
    } catch (e) {
      // Not stored → retried on the next run. Never store unclassified evidence as a signal.
      ctx.errors.push({ at: new Date().toISOString(), vc: vc.name, source: "gemini", message: errMsg(e) });
      continue;
    }
    const now = new Date();
    const rows = batch.map((c, j) => ({
      vc_id: vc.id,
      url: c.url,
      title: c.title.slice(0, 500),
      snippet: c.snippet.slice(0, 1000),
      source: c.source,
      signal_type: labels[j].signal_type,
      relevance: Math.round(labels[j].relevance * 100) / 100,
      is_about_vc: labels[j].is_about_vc,
      summary: labels[j].summary || null,
      published_at: c.publishedAt.toISOString(),
      classified_at: now.toISOString(),
    }));
    const { data, error } = await db()
      .from("signals")
      .upsert(rows, { onConflict: "vc_id,url_hash", ignoreDuplicates: true })
      .select("id");
    if (error) {
      ctx.errors.push({ at: now.toISOString(), vc: vc.name, source: "supabase", message: error.message });
      continue;
    }
    inserted += data?.length ?? 0;
    activeAbout += rows.filter((r, j) => r.is_about_vc && ageInDays(batch[j].publishedAt, now) <= env.activeDays).length;
  }
  return { inserted, activeAbout };
}

/** Collect live evidence for one VC, classify new items with Gemini, store them. Touches only `signals`. */
export async function ingestVc(vc: Vc, ctx: IngestCtx): Promise<number> {
  const days = env.lookbackDays;
  const now = new Date();

  const { data: existing, error } = await db()
    .from("signals")
    .select("url_hash, published_at, is_about_vc")
    .eq("vc_id", vc.id);
  if (error) throw new Error(`load signals: ${error.message}`);
  const known = new Set((existing ?? []).map((r) => r.url_hash as string));
  const hadActive = (existing ?? []).some((r) => r.is_about_vc && ageInDays(r.published_at, now) <= env.activeDays);

  if (!ctx.firmCache.has(vc.firm)) ctx.firmCache.set(vc.firm, googleNewsFirm(vc.firm, days));

  const jobs: Array<[string, Promise<Candidate[]>]> = [
    ["google_news", googleNewsPerson(vc, days)],
    ["google_news_firm", ctx.firmCache.get(vc.firm)!],
    ["gdelt", gdeltPerson(vc, days)],
    ["rss", blogRss(vc, days)],
  ];
  if (linkedinEnabled() && vc.linkedin_url) jobs.push(["linkedin", linkedinPosts(vc, days)]);

  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  let candidates: Candidate[] = [];
  settled.forEach((s, i) => {
    const source = jobs[i][0];
    if (s.status === "rejected") {
      // Any single source failing is non-fatal.
      ctx.errors.push({ at: new Date().toISOString(), vc: vc.name, source, message: errMsg(s.reason) });
      return;
    }
    const items = source === "google_news_firm" ? [...s.value].sort((a, b) => +b.publishedAt - +a.publishedAt).slice(0, MAX_FIRM_CANDIDATES) : s.value;
    candidates.push(...items);
  });

  candidates = dedupe(candidates)
    .filter((c) => withinDays(c.publishedAt, days, now) && !known.has(md5(c.url)))
    .sort((a, b) => +b.publishedAt - +a.publishedAt)
    .slice(0, MAX_CANDIDATES_PER_VC);

  const free = await classifyAndStore(vc, candidates, ctx);
  candidates.forEach((c) => known.add(md5(c.url)));
  let inserted = free.inserted;

  // Firecrawl only when the free sources produced no active (≤30d) signal for this VC.
  if (!hadActive && free.activeAbout === 0 && env.firecrawlKey) {
    try {
      const fc = await firecrawlPerson(vc, days);
      ctx.credits += fc.creditsUsed;
      const fresh = dedupe(fc.candidates).filter((c) => !known.has(md5(c.url)));
      inserted += (await classifyAndStore(vc, fresh, ctx)).inserted;
    } catch (e) {
      ctx.errors.push({ at: new Date().toISOString(), vc: vc.name, source: "firecrawl", message: errMsg(e) });
    }
  }
  return inserted;
}

/**
 * Score one VC deterministically and write ONLY the 4 signal columns via the
 * update_vc_signals RPC (Postgres column GRANTs block every other column).
 */
export async function scoreAndWrite(
  vc: Vc,
  signals: ScoreSignal[],
  errors: RunError[],
): Promise<{ bucket: Bucket; score: number }> {
  const now = new Date();
  const result = scoreVc({
    status: vc.contact_status,
    lastContactDate: vc.last_contact_date,
    signals,
    now,
    activeDays: env.activeDays,
    lookbackDays: env.lookbackDays,
  });
  const contactAgeDays = vc.last_contact_date ? ageInDays(vc.last_contact_date, now) : null;
  const top = result.scored[0];

  let action = templateAction({ vc, top, bucket: result.bucket, contactAgeDays });
  if (top && result.bucket !== "quiet" && vc.contact_status !== "passed") {
    try {
      action = await recommendAction({ vc, top: result.scored, bucket: result.bucket, contactAgeDays });
    } catch (e) {
      errors.push({ at: now.toISOString(), vc: vc.name, source: "gemini_action", message: errMsg(e) });
    }
  }

  const { error } = await db().rpc("update_vc_signals", {
    p_vc_id: vc.id,
    p_last_signal_date: result.lastSignalDate,
    p_signal_summary: buildSignalSummary(result.scored, [vc.name, vc.firm]),
    p_follow_up_score: result.score,
    p_recommended_action: action,
  });
  if (error) throw new Error(`update_vc_signals(${vc.name}): ${error.message}`);
  return { bucket: result.bucket, score: result.score };
}

export async function loadRelevantSignals(vcIds: string[]): Promise<Map<string, ScoreSignal[]>> {
  const map = new Map<string, ScoreSignal[]>();
  if (vcIds.length === 0) return map;
  const { data, error } = await db()
    .from("signals")
    .select("vc_id, url, title, summary, signal_type, relevance, is_about_vc, published_at, source")
    .in("vc_id", vcIds)
    .eq("is_about_vc", true);
  if (error) throw new Error(`load relevant signals: ${error.message}`);
  for (const row of data ?? []) {
    const list = map.get(row.vc_id) ?? [];
    list.push({ ...row, relevance: row.relevance === null ? null : Number(row.relevance) });
    map.set(row.vc_id, list);
  }
  return map;
}
