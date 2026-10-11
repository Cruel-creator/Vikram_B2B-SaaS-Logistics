import Link from "next/link";
import { Board } from "@/components/Board";
import { RunNow } from "@/components/RunNow";
import { CheckIcon } from "@/components/ui";
import { getDashboardData, type DashboardData } from "@/lib/dashboard";
import { BUCKET_META, fmtDateTime, relTime, TZ } from "@/lib/format";

export const dynamic = "force-dynamic";

function weekLabel() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const monday = new Date(ist);
  monday.setDate(ist.getDate() - ((ist.getDay() + 6) % 7));
  return monday.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

export default async function Home() {
  const data = await getDashboardData();
  const reach = data.vcs.filter((v) => v.bucket === "reach_out").length;
  const warm = data.vcs.filter((v) => v.bucket === "warm").length;
  const quiet = data.vcs.filter((v) => v.bucket === "quiet").length;

  return (
    <>
      {/* Hero */}
      <section className="grid gap-8 pb-10 pt-12 sm:pt-16 lg:grid-cols-[1.35fr_1fr] lg:items-end">
        <div className="animate-rise">
          <div className="eyebrow mb-5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-reach shadow-[0_0_10px_var(--color-reach)]" />
            Seed outreach brief · week of {weekLabel()}
          </div>
          <h1 className="font-display text-[52px] leading-[0.95] tracking-[-0.02em] sm:text-[76px]">
            {data.scoredAt ? (
              <>
                <span className="text-reach">{reach}</span> {reach === 1 ? "investor is" : "investors are"} worth
                <br className="hidden sm:block" /> a note <span className="italic text-muted">this week.</span>
              </>
            ) : (
              <>
                Who to pitch
                <br className="hidden sm:block" /> <span className="italic text-muted">this week.</span>
              </>
            )}
          </h1>
          <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-muted">
            Ranked from <span className="text-fg">observable signals in the last 30 days</span>: what each of Vikram&apos;s{" "}
            {data.vcs.length || 50} target investors wrote, said, invested in or showed up at, all from live sources and
            scored by a transparent formula.
          </p>
        </div>

        <RunCard data={data} />
      </section>

      {!data.configured && <SetupNotice />}
      {data.error && (
        <div className="card mb-8 border-bad/30 p-5 text-[13px] text-bad">Could not load data: {data.error}</div>
      )}

      {data.vcs.length > 0 && (
        <>
          <PipelineBar reach={reach} warm={warm} quiet={quiet} active={data.activeSignals} total={data.totalSignals} />
          {!data.scoredAt && (
            <div className="card mb-8 p-5 text-[14px] text-muted">
              Investors are seeded but not scored yet. Press <span className="text-reach">Run now</span> to collect signals and
              compute this week&apos;s ranking.
            </div>
          )}
          <Board vcs={data.vcs} />
          <FormulaStrip />
        </>
      )}
    </>
  );
}

function RunCard({ data }: { data: DashboardData }) {
  const run = data.lastFinishedRun;
  const running = data.lastRun?.status === "running" && Date.now() - Date.parse(data.lastRun.started_at) < 20 * 60_000;
  const pc = run?.protected_check;
  const statusColor =
    run?.status === "success" ? "bg-ok" : run?.status === "partial" ? "bg-warm" : run?.status === "failed" ? "bg-bad" : "bg-faint";

  return (
    <div className="card animate-rise p-5 [animation-delay:120ms] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Last run</div>
          <div className="mt-1.5 flex items-center gap-2 text-[22px] font-medium tracking-tight">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} />
            {run ? relTime(run.finished_at ?? run.started_at) : "Never"}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-faint">
            {run ? `${fmtDateTime(run.finished_at ?? run.started_at)} IST · ${run.kind} · ${run.trigger} · ${run.status}` : "No runs yet"}
          </div>
        </div>
        <RunNow initiallyRunning={running} />
      </div>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-white/[0.015]">
        <Stat label="VCs processed" value={run?.vcs_processed ?? "–"} />
        <Stat label="New signals" value={run?.signals_new ?? "–"} />
        <Stat label="Firecrawl credits" value={run?.firecrawl_credits ?? "–"} />
      </dl>

      <div
        className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-[12.5px] ${
          pc?.unchanged ? "border-ok/25 bg-ok/[0.06] text-ok" : pc ? "border-bad/30 bg-bad/[0.06] text-bad" : "border-line text-faint"
        }`}
      >
        <span className="flex items-center gap-2 font-medium">
          {pc?.unchanged ? <CheckIcon /> : null}
          {pc?.unchanged ? "Manual columns unchanged ✓" : pc ? "Manual columns changed during run" : "Manual-column check pending"}
        </span>
        {pc?.after_hash && <span className="font-mono text-[10.5px] opacity-70">md5 {pc.after_hash.slice(0, 8)}…</span>}
      </div>
      <Link href="/runs" className="mt-3 inline-block font-mono text-[11px] text-faint hover:text-muted">
        View run log →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-3 py-3">
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">{label}</dt>
      <dd className="mt-1 font-mono text-[20px] tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function PipelineBar({ reach, warm, quiet, active, total }: { reach: number; warm: number; quiet: number; active: number; total: number }) {
  const all = Math.max(1, reach + warm + quiet);
  const segs = [
    { k: "reach_out" as const, n: reach },
    { k: "warm" as const, n: warm },
    { k: "quiet" as const, n: quiet },
  ];
  return (
    <div className="card mb-6 animate-rise p-5 [animation-delay:200ms] sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="eyebrow">Pipeline · {all} investors</div>
        <div className="flex gap-6 font-mono text-[11px] text-muted">
          <span>
            <span className="text-fg">{active}</span> active signals (≤30d)
          </span>
          <span>
            <span className="text-fg">{total}</span> relevant (≤60d)
          </span>
        </div>
      </div>
      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full">
        {segs.map(
          (s) =>
            s.n > 0 && (
              <a
                key={s.k}
                href={`#${s.k}`}
                className="h-full rounded-full transition-opacity hover:opacity-80"
                style={{ width: `${(s.n / all) * 100}%`, background: BUCKET_META[s.k].color, opacity: s.k === "quiet" ? 0.45 : 1 }}
                aria-label={`${BUCKET_META[s.k].title}: ${s.n}`}
              />
            ),
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {segs.map((s) => (
          <a key={s.k} href={`#${s.k}`} className="group">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_META[s.k].color }} />
              <span className="truncate text-[12.5px] text-muted group-hover:text-fg">{BUCKET_META[s.k].title}</span>
            </div>
            <div className="mt-1 font-display text-[34px] leading-none tabular-nums">{s.n}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function FormulaStrip() {
  return (
    <section className="card mt-4 overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
        <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="eyebrow mb-3">Scoring · deterministic</div>
          <h3 className="font-display text-[30px] leading-tight">
            No black box. <span className="italic text-muted">Every point is explainable.</span>
          </h3>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Gemini Flash only <span className="text-fg">classifies</span> fetched evidence and drafts the next move. The score
            itself is plain arithmetic, so the same inputs always give the same rank.
          </p>
          <Link href="/about" className="mt-4 inline-block font-mono text-[12px] text-reach hover:underline">
            Read how it works →
          </Link>
        </div>
        <pre className="overflow-x-auto p-6 font-mono text-[12px] leading-[1.75] text-muted">
          <span className="text-faint">{"// per relevant signal (is_about_vc = true)"}</span>
          {"\n"}value   = relevance × type_weight × recency(age)
          {"\n"}recency = <span className="text-reach">0–30d</span> 1.0 − 0.3·age/30 · <span className="text-warm">31–60d</span> 0.4 − 0.3·(age−30)/30
          {"\n"}base    = max(value) + min(0.15, 0.05 × (active − 1))
          {"\n"}
          {"\n"}<span className="text-faint">{"// contact status"}</span>
          {"\n"}passed → 0 · waiting &lt;7d → cap 0.40 · waiting ≥14d + active → +0.10
          {"\n"}score   = round(100 × clamp(base, 0, 1))
          {"\n"}<span className="text-reach">reach out</span> ≥ 60 + active · <span className="text-warm">warm</span> 25–59 or cooling only · <span className="text-quiet">quiet</span> otherwise
        </pre>
      </div>
    </section>
  );
}

function SetupNotice() {
  return (
    <div className="card mb-8 p-6">
      <div className="eyebrow mb-2">Setup</div>
      <p className="text-[14px] text-muted">
        Supabase isn&apos;t configured. Set <code className="font-mono text-fg">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-fg">SUPABASE_SECRET_KEY</code>, run <code className="font-mono text-fg">npm run seed</code>,
        then press Run now.
      </p>
    </div>
  );
}
