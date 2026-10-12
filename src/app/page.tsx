import { Board } from "@/components/Board";
import { RunNow } from "@/components/RunNow";
import { HeroBackdrop } from "@/components/motion/HeroBackdrop";
import { HeroMotion } from "@/components/motion/HeroMotion";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import BlurText from "@/components/react-bits/BlurText";
import { getDashboardData, type DashboardData } from "@/lib/dashboard";
import { BUCKET_META, fmtDateTime, relTime, RUN_KIND_LABEL, runOutcome, TZ } from "@/lib/format";

export const dynamic = "force-dynamic";

function weekLabel() {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const monday = new Date(ist);
  monday.setDate(ist.getDate() - ((ist.getDay() + 6) % 7));
  return monday.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

export default async function Home() {
  const data = await getDashboardData();
  const reach = data.vcs.filter((v) => v.bucket === "reach_out").length;
  const warm = data.vcs.filter((v) => v.bucket === "warm").length;
  const quiet = data.vcs.filter((v) => v.bucket === "quiet").length;
  const total = data.vcs.length || 50;

  return (
    <>
      {/* Hero stadium */}
      <HeroMotion className="relative overflow-hidden rounded-[40px] border border-line bg-lifted">
        <HeroBackdrop />
        <OrbitArc />
        <div className="pointer-events-none relative grid grid-cols-1 gap-10 p-6 sm:p-12 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-14 lg:p-14">
          <div className="pointer-events-auto min-w-0">
            <div data-hero className="eyebrow mb-7">
              Seed outreach brief · week of {weekLabel()}
            </div>
            <h1 className="text-[46px] leading-[1] tracking-[-0.02em] sm:text-[68px]">
              <BlurText as="span" text="Who to pitch" delay={90} stepDuration={0.3} />
              <BlurText as="span" text="this week." delay={90} stepDuration={0.3} className="text-slate" />
            </h1>
            <p data-hero className="mt-7 max-w-[520px] text-[17px] leading-[1.5] text-charcoal">
              {data.scoredAt ? (
                <>
                  <AnimatedNumber value={reach} className="font-medium text-go" springOptions={{ bounce: 0, duration: 1600 }} />{" "}
                  of {total} investors have a fresh, relevant signal: something they wrote, said, invested in or showed up at in
                  the last 30 days.
                </>
              ) : (
                <>Ranked from observable signals in the last 30 days, from live sources and a transparent formula.</>
              )}
            </p>
            <div data-hero className="mt-8 flex flex-wrap gap-2">
              <a href="#reach_out" className="btn btn-ink">
                See this week&apos;s list
              </a>
            </div>
          </div>
          <div data-hero className="pointer-events-auto min-w-0">
            <RunCard data={data} />
          </div>
        </div>
      </HeroMotion>

      {!data.configured && <SetupNotice />}
      {data.error && <div className="card mt-8 p-6 text-[14px] text-bad">Could not load data: {data.error}</div>}

      {data.vcs.length > 0 && (
        <>
          <PipelineStrip reach={reach} warm={warm} quiet={quiet} active={data.activeSignals} relevant={data.totalSignals} />
          {!data.scoredAt && (
            <div className="card mt-6 p-6 text-[15px] text-charcoal">
              Investors are seeded but not scored yet. Press <strong className="font-medium">Run now</strong> to collect
              signals and compute this week&apos;s ranking.
            </div>
          )}
          <div className="mt-16">
            <Board vcs={data.vcs} />
          </div>
        </>
      )}
    </>
  );
}

/** Decorative orbit arc in signal orange; drawn on load by HeroMotion's GSAP timeline. */
function OrbitArc() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 560"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        data-orbit
        d="M -40 520 C 260 420, 560 600, 860 420 S 1180 180, 1260 120"
        fill="none"
        stroke="var(--color-signal)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle data-orbit-dot cx="1130" cy="222" r="5" fill="var(--color-signal)" />
    </svg>
  );
}

function RunCard({ data }: { data: DashboardData }) {
  const run = data.lastFinishedRun;
  const running = data.lastRun?.status === "running" && Date.now() - Date.parse(data.lastRun.started_at) < 20 * 60_000;
  const pc = run?.protected_check;
  const outcome = run ? runOutcome(run) : null;
  const dot =
    outcome?.status === "complete"
      ? "var(--color-go)"
      : outcome?.status === "partial"
        ? "var(--color-watch-ring)"
        : outcome?.status === "failed"
          ? "var(--color-bad)"
          : "var(--color-taupe)";

  return (
    <div className="rounded-[24px] border border-line bg-surface p-5 shadow-lift sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow" style={{ ["--dot" as string]: dot }}>
            Last run{outcome ? ` · ${outcome.status}` : ""}
          </div>
          <div className="mt-3 text-[30px] font-medium leading-none tracking-[-0.02em]">
            {run ? relTime(run.finished_at ?? run.started_at) : "Never"}
          </div>
          <div className="mt-2 truncate text-[13px] text-slate">
            {run
              ? `${fmtDateTime(run.finished_at ?? run.started_at)} IST · ${RUN_KIND_LABEL[run.kind]} · ${run.trigger === "cron" ? "automatic" : "manual"}`
              : "No runs yet"}
          </div>
          {outcome?.note && <div className="mt-1 text-[12.5px] text-taupe">{outcome.note}</div>}
        </div>
        <RunNow initiallyRunning={running} />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-1.5 sm:gap-2">
        <Stat label="VCs" value={run?.vcs_processed ?? null} />
        <Stat label="New signals" value={run?.signals_new ?? null} />
        <Stat label="Credits" value={run?.firecrawl_credits ?? null} />
      </dl>

      <div
        className={`mt-4 flex min-h-11 items-center justify-between gap-3 rounded-full px-4 text-[13.5px] ${
          pc?.unchanged ? "bg-go-tint text-go" : pc ? "bg-[#FDECEA] text-bad" : "bg-canvas text-slate"
        }`}
      >
        <span className="font-medium">
          {pc?.unchanged ? "Manual columns unchanged ✓" : pc ? "Manual columns changed during run" : "Manual-column check pending"}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[20px] bg-canvas px-3.5 py-3">
      <dt className="micro text-[10px]">{label}</dt>
      <dd className="mt-1.5 text-[24px] font-medium leading-none tracking-[-0.02em]">
        {value === null ? "–" : <AnimatedNumber value={value} springOptions={{ bounce: 0, duration: 1200 }} />}
      </dd>
    </div>
  );
}

function PipelineStrip({
  reach,
  warm,
  quiet,
  active,
  relevant,
}: {
  reach: number;
  warm: number;
  quiet: number;
  active: number;
  relevant: number;
}) {
  const all = Math.max(1, reach + warm + quiet);
  const segs = [
    { k: "reach_out" as const, n: reach },
    { k: "warm" as const, n: warm },
    { k: "quiet" as const, n: quiet },
  ];
  return (
    <section data-reveal className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="card p-7 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="eyebrow">Pipeline · {all} investors</div>
          <div className="text-[13px] text-slate">Bucketed by this run&apos;s scores</div>
        </div>
        <div className="flex h-3 w-full gap-1.5 overflow-hidden rounded-full">
          {segs.map(
            (s) =>
              s.n > 0 && (
                <a
                  key={s.k}
                  href={`#${s.k}`}
                  className="h-full rounded-full transition-opacity duration-150 hover:opacity-80"
                  style={{ width: `${(s.n / all) * 100}%`, background: BUCKET_META[s.k].color }}
                  aria-label={`${BUCKET_META[s.k].title}: ${s.n}`}
                />
              ),
          )}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {segs.map((s) => (
            <a key={s.k} href={`#${s.k}`} className="group min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: BUCKET_META[s.k].color }} />
                <span className="truncate text-[13.5px] text-slate transition-colors duration-150 group-hover:text-ink">
                  {BUCKET_META[s.k].title}
                </span>
              </div>
              <AnimatedNumber
                as="div"
                value={s.n}
                className="mt-2 text-[44px] font-medium leading-none tracking-[-0.03em]"
                springOptions={{ bounce: 0, duration: 1400 }}
              />
            </a>
          ))}
        </div>
      </div>
      <div className="card grid grid-cols-2 gap-4 p-7 sm:p-8">
        <div>
          <div className="micro">Active signals</div>
          <AnimatedNumber as="div" value={active} className="mt-3 text-[44px] font-medium leading-none tracking-[-0.03em] text-go" />
          <p className="mt-2 text-[13px] leading-[1.45] text-slate">Within 30 days: these can trigger outreach</p>
        </div>
        <div>
          <div className="micro">Relevant · 60d</div>
          <AnimatedNumber as="div" value={relevant} className="mt-3 text-[44px] font-medium leading-none tracking-[-0.03em]" />
          <p className="mt-2 text-[13px] leading-[1.45] text-slate">Verified as about the right person by Gemini</p>
        </div>
      </div>
    </section>
  );
}

function SetupNotice() {
  return (
    <div className="card mt-8 p-7">
      <div className="eyebrow mb-3">Setup</div>
      <p className="text-[15px] text-charcoal">
        Supabase isn&apos;t configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SECRET_KEY</code>, run{" "}
        <code>npm run seed</code>, then press Run now.
      </p>
    </div>
  );
}
