import type { Bucket, ContactStatus, SignalType } from "./types";

/**
 * Deterministic, explainable follow-up scoring. Pure: no I/O, no AI.
 * The exact same formula is rendered on the dashboard and /about.
 */

export const TYPE_WEIGHT: Record<SignalType, number> = {
  investment: 1.0,
  blog_post: 0.9,
  interview: 0.9,
  event: 0.8,
  social_post: 0.6,
  news_mention: 0.5,
  other: 0.3,
};

export const DAY_MS = 86_400_000;

export interface ScoreSignal {
  url: string;
  title: string | null;
  summary: string | null;
  signal_type: SignalType | null;
  relevance: number | null;
  is_about_vc: boolean | null;
  published_at: string;
  source?: string;
}

export interface ScoredSignal extends ScoreSignal {
  ageDays: number;
  recency: number;
  weight: number;
  value: number;
  window: "active" | "cooling";
}

export interface ScoreInput {
  status: ContactStatus;
  lastContactDate: string | null;
  signals: ScoreSignal[];
  now?: Date;
  activeDays?: number;
  lookbackDays?: number;
}

export interface ScoreResult {
  score: number;
  base: number;
  bucket: Bucket;
  scored: ScoredSignal[];
  activeCount: number;
  coolingCount: number;
  lastSignalDate: string | null;
  statusRule: "passed" | "give_time" | "nudge" | null;
  explanation: string[];
}

export function ageInDays(publishedAt: string | Date, now: Date): number {
  const t = typeof publishedAt === "string" ? Date.parse(publishedAt) : publishedAt.getTime();
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

/** 0–30 → 1.0 − 0.3·(age/30) ; 31–60 → 0.4 − 0.3·((age−30)/30) ; >60 → 0 */
export function recency(ageDays: number, activeDays = 30, lookbackDays = 60): number {
  const a = Math.max(0, ageDays);
  if (a <= activeDays) return 1.0 - 0.3 * (a / activeDays);
  if (a <= lookbackDays) return 0.4 - 0.3 * ((a - activeDays) / (lookbackDays - activeDays));
  return 0;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

export function scoreVc(input: ScoreInput): ScoreResult {
  const now = input.now ?? new Date();
  const activeDays = input.activeDays ?? 30;
  const lookbackDays = input.lookbackDays ?? 60;
  const explanation: string[] = [];

  const relevant = input.signals.filter((s) => s.is_about_vc === true);

  const newest = relevant.reduce<string | null>(
    (acc, s) => (!acc || Date.parse(s.published_at) > Date.parse(acc) ? s.published_at : acc),
    null,
  );
  const lastSignalDate = newest ? new Date(newest).toISOString().slice(0, 10) : null;

  const scored: ScoredSignal[] = relevant
    .map((s) => {
      const ageDays = ageInDays(s.published_at, now);
      const rec = recency(ageDays, activeDays, lookbackDays);
      const weight = TYPE_WEIGHT[s.signal_type ?? "other"] ?? TYPE_WEIGHT.other;
      const value = clamp01(s.relevance ?? 0) * weight * rec;
      return {
        ...s,
        ageDays,
        recency: rec,
        weight,
        value,
        window: ageDays <= activeDays ? ("active" as const) : ("cooling" as const),
      };
    })
    .filter((s) => s.ageDays <= lookbackDays)
    .sort((a, b) => b.value - a.value || a.ageDays - b.ageDays);

  const activeCount = scored.filter((s) => s.window === "active").length;
  const coolingCount = scored.length - activeCount;

  let base = 0;
  if (scored.length > 0) {
    const top = scored[0];
    base = top.value;
    explanation.push(
      `Top signal: ${top.signal_type ?? "other"} ${r2(top.weight)} × relevance ${r2(top.relevance ?? 0)} × recency ${r2(top.recency)} = ${r2(top.value)}`,
    );
    const bonus = Math.max(0, Math.min(0.15, 0.05 * (activeCount - 1)));
    if (bonus > 0) {
      base += bonus;
      explanation.push(`+${r2(bonus)} momentum bonus (${activeCount} active signals)`);
    }
  } else {
    explanation.push("No relevant signal in the last 60 days");
  }

  let statusRule: ScoreResult["statusRule"] = null;
  const contactAge = input.lastContactDate ? ageInDays(input.lastContactDate, now) : null;
  if (input.status === "passed") {
    base = 0;
    statusRule = "passed";
    explanation.push("Status is passed → score 0");
  } else if (input.status === "waiting_for_response" && contactAge !== null && contactAge < 7) {
    if (base > 0.4) explanation.push(`Contacted ${contactAge}d ago → capped at 0.40 (give them time)`);
    base = Math.min(base, 0.4);
    statusRule = "give_time";
  } else if (
    input.status === "waiting_for_response" &&
    contactAge !== null &&
    contactAge >= 14 &&
    activeCount > 0
  ) {
    base += 0.1;
    statusRule = "nudge";
    explanation.push(`+0.10 nudge (waiting ${contactAge}d, fresh signal to reference)`);
  }

  const score = Math.round(100 * clamp01(base));

  let bucket: Bucket;
  if (input.status === "passed") bucket = "quiet";
  else if (score >= 60 && activeCount > 0) bucket = "reach_out";
  else if (score >= 25) bucket = "warm";
  else if (activeCount === 0 && coolingCount > 0 && score > 0) bucket = "warm";
  else bucket = "quiet";

  return {
    score,
    base: r2(base),
    bucket,
    scored,
    activeCount,
    coolingCount,
    lastSignalDate,
    statusRule,
    explanation,
  };
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export const NO_SIGNAL_SUMMARY = "No observable signal in last 60 days";

const STORY_STOP = new Set([
  "AI", "A", "The", "Series", "Seed", "Pre", "India", "Indian", "US", "USD", "Rs", "INR", "Cr", "Mn", "Inc", "Ltd",
  "Capital", "Ventures", "Partners", "Fund", "B2B", "SaaS", "CEO", "Founder",
]);

/**
 * Story key for collapsing the same event reported by several outlets: the first proper
 * noun in the summary (then title) that isn't the investor's own name/firm or a generic
 * word, e.g. "Polygrade", "Lumio". Falls back to the URL (always unique).
 */
export function storyKey(s: Pick<ScoreSignal, "summary" | "title" | "url">, exclude: string[] = []): string {
  const ex = new Set(exclude.flatMap((e) => e.split(/[\s()]+/)).map((w) => w.toLowerCase()));
  const text = `${s.summary ?? ""} ${s.title ?? ""}`;
  const token = (text.match(/\b[A-Z][A-Za-z0-9&]{2,}\b/g) ?? []).find(
    (t) => !STORY_STOP.has(t) && !ex.has(t.toLowerCase()),
  );
  return token ? token.toLowerCase() : s.url;
}

/** Keep the highest-ranked signal per story (input is already sorted by value). */
export function uniqueStories<T extends Pick<ScoreSignal, "summary" | "title" | "url">>(scored: T[], exclude: string[] = []): T[] {
  const seen = new Set<string>();
  return scored.filter((s) => {
    const k = storyKey(s, exclude);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Top 1–2 signal summaries with dates (one per story). */
export function buildSignalSummary(scored: ScoredSignal[], exclude: string[] = []): string {
  if (scored.length === 0) return NO_SIGNAL_SUMMARY;
  return uniqueStories(scored, exclude)
    .slice(0, 2)
    .map((s) => `${fmt(s.published_at)}: ${(s.summary || s.title || "").trim()}`)
    .join(" · ");
}

export function bucketFromStored(score: number | null, hasActiveSignal: boolean, hasAnySignal: boolean): Bucket {
  const s = score ?? 0;
  if (s >= 60 && hasActiveSignal) return "reach_out";
  if (s >= 25) return "warm";
  if (!hasActiveSignal && hasAnySignal && s > 0) return "warm";
  return "quiet";
}
