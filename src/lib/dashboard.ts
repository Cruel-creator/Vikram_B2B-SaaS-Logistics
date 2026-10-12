import { env } from "./env";
import { splitTitle } from "./format";
import { bucketFromStored, scoreVc, uniqueStories, type ScoreSignal } from "./scoring";
import { db } from "./supabase";
import type { Bucket, ContactStatus, RunRow, SignalType, Vc } from "./types";

export interface EvidenceView {
  url: string;
  headline: string;
  publisher: string;
  source: string;
  publishedAt: string;
  ageDays: number;
  window: "active" | "cooling";
  type: SignalType;
  summary: string | null;
  relevance: number;
}

export interface VcView {
  id: string;
  name: string;
  firm: string;
  role: string | null;
  location: string | null;
  focusTags: string[];
  linkedinUrl: string | null;
  firmWebsite: string | null;
  status: ContactStatus;
  lastContactDate: string | null;
  contactHistory: string | null;
  personalNotes: string | null;
  lastSignalDate: string | null;
  signalSummary: string | null;
  score: number | null;
  recommendedAction: string | null;
  bucket: Bucket;
  activeCount: number;
  coolingCount: number;
  explanation: string[];
  evidence: EvidenceView[];
}

export interface DashboardData {
  vcs: VcView[];
  lastRun: RunRow | null;
  lastFinishedRun: RunRow | null;
  activeSignals: number;
  totalSignals: number;
  sourcesHit: Record<string, number>;
  scoredAt: boolean;
  configured: boolean;
  error?: string;
}

const EMPTY: DashboardData = {
  vcs: [],
  lastRun: null,
  lastFinishedRun: null,
  activeSignals: 0,
  totalSignals: 0,
  sourcesHit: {},
  scoredAt: false,
  configured: false,
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return EMPTY;
  try {
    const since = new Date(Date.now() - env.lookbackDays * 86_400_000).toISOString();
    const [vcsRes, sigRes, runsRes] = await Promise.all([
      db().from("vcs").select("*").order("follow_up_score", { ascending: false, nullsFirst: false }).order("name"),
      db()
        .from("signals")
        .select("vc_id, url, title, summary, signal_type, relevance, is_about_vc, published_at, source")
        .eq("is_about_vc", true)
        .gte("published_at", since)
        .order("published_at", { ascending: false }),
      db().from("runs").select("*").order("started_at", { ascending: false }).limit(10),
    ]);
    if (vcsRes.error) throw vcsRes.error;
    if (sigRes.error) throw sigRes.error;

    const byVc = new Map<string, (ScoreSignal & { source: string })[]>();
    const sourcesHit: Record<string, number> = {};
    for (const s of sigRes.data ?? []) {
      const list = byVc.get(s.vc_id) ?? [];
      list.push({ ...s, relevance: s.relevance === null ? null : Number(s.relevance) });
      byVc.set(s.vc_id, list);
      sourcesHit[s.source] = (sourcesHit[s.source] ?? 0) + 1;
    }

    const now = new Date();
    let activeSignals = 0;
    const vcs: VcView[] = ((vcsRes.data ?? []) as Vc[]).map((vc) => {
      const signals = byVc.get(vc.id) ?? [];
      const r = scoreVc({
        status: vc.contact_status,
        lastContactDate: vc.last_contact_date,
        signals,
        now,
        activeDays: env.activeDays,
        lookbackDays: env.lookbackDays,
      });
      activeSignals += r.activeCount;
      const bucket =
        vc.follow_up_score === null
          ? r.bucket
          : vc.contact_status === "passed"
            ? "quiet"
            : bucketFromStored(vc.follow_up_score, r.activeCount > 0, r.scored.length > 0);
      return {
        id: vc.id,
        name: vc.name,
        firm: vc.firm,
        role: vc.role,
        location: vc.location,
        focusTags: vc.focus_tags ?? [],
        linkedinUrl: vc.linkedin_url,
        firmWebsite: vc.firm_website,
        status: vc.contact_status,
        lastContactDate: vc.last_contact_date,
        contactHistory: vc.contact_history,
        personalNotes: vc.personal_notes,
        lastSignalDate: vc.last_signal_date,
        signalSummary: vc.signal_summary,
        score: vc.follow_up_score,
        recommendedAction: vc.recommended_action,
        bucket,
        activeCount: r.activeCount,
        coolingCount: r.coolingCount,
        explanation: r.explanation,
        evidence: uniqueStories(r.scored, [vc.name, vc.firm]).slice(0, 4).map((s) => {
          const { headline, publisher } = splitTitle(s.title, s.url, s.source ?? "");
          return {
            url: s.url,
            headline,
            publisher,
            source: s.source ?? "",
            publishedAt: s.published_at,
            ageDays: s.ageDays,
            window: s.window,
            type: (s.signal_type ?? "other") as SignalType,
            summary: s.summary,
            relevance: s.relevance ?? 0,
          };
        }),
      };
    });

    const runs = (runsRes.data ?? []) as RunRow[];
    return {
      vcs,
      lastRun: runs[0] ?? null,
      lastFinishedRun: runs.find((r) => r.status !== "running") ?? null,
      activeSignals,
      totalSignals: sigRes.data?.length ?? 0,
      sourcesHit,
      scoredAt: vcs.some((v) => v.score !== null),
      configured: true,
    };
  } catch (e) {
    return { ...EMPTY, configured: true, error: e instanceof Error ? e.message : String(e) };
  }
}
