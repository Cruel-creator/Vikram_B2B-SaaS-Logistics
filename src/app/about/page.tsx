import { TYPE_WEIGHT } from "@/lib/scoring";
import { TYPE_LABEL } from "@/lib/format";
import type { SignalType } from "@/lib/types";

export const metadata = { title: "How it works — Pipeline Intel" };

const STEPS = [
  {
    n: "01",
    t: "Collect",
    d: "Every day at 06:00 IST, live sources are queried for each investor: Google News RSS (name + firm, plus the firm's recent deals), GDELT, and the investor's own blog or Substack. Anything without a real URL and a published date is dropped.",
  },
  {
    n: "02",
    t: "Verify",
    d: "Gemini Flash reads only the fetched text and labels each item: is it really this person at this firm (namesakes rejected), what kind of signal it is, how relevant it is to Seed-stage B2B logistics SaaS, and a factual summary of 25 words or less.",
  },
  {
    n: "03",
    t: "Fallback",
    d: "If the free sources found nothing in the last 30 days, a single Firecrawl web search runs for that investor. Results are cached for 72 hours, so the free-tier credits last the month.",
  },
  {
    n: "04",
    t: "Score",
    d: "Monday and Thursday at 07:00 IST a deterministic formula ranks everyone. Gemini then writes the next move, citing the top signal and the contact status. Only 4 columns are written back.",
  },
];

export default function About() {
  const types = Object.entries(TYPE_WEIGHT) as Array<[SignalType, number]>;
  return (
    <div>
      {/* Header with ghost watermark */}
      <header className="relative overflow-hidden pb-16 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 select-none text-[clamp(120px,22vw,300px)] font-medium leading-none tracking-[-0.04em] text-ghost"
        >
          Method
        </div>
        <div className="relative">
          <div data-reveal className="eyebrow mb-6">
            How it works
          </div>
          <h1 data-reveal className="max-w-3xl text-[46px] leading-[1] sm:text-[64px]">
            Observable signals in. A short list out.
          </h1>
          <p data-reveal className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-charcoal">
            Vikram is a first-time founder raising a Seed round for a B2B logistics SaaS. He tracks around 50 VCs. Twice a week
            this tells him <span className="font-medium text-ink">who is worth reaching out to this week and why</span>, based
            on something each investor wrote, said, invested in or appeared at in the past 30 days. It also flags who has gone
            quiet.
          </p>
        </div>
      </header>

      <div data-reveal className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="card card-lift p-7">
            <div className="tnum text-[13px] font-bold text-signal">{s.n}</div>
            <h3 className="mt-4 text-[26px] leading-none">{s.t}</h3>
            <p className="mt-4 text-[14.5px] leading-[1.55] text-charcoal">{s.d}</p>
          </div>
        ))}
      </div>

      <section className="mt-24">
        <div data-reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-4">Architecture</div>
            <h2 className="text-[36px] leading-[1.1] sm:text-[44px]">Components Map</h2>
          </div>
          <a href="/components-map.svg" target="_blank" className="btn btn-ghost">
            Open full size ↗
          </a>
        </div>
        <div data-reveal className="card overflow-hidden p-3 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/components-map.svg"
            alt="Components map: triggers, live sources, ingest and score routes, Gemini Flash, Supabase tables and the dashboard"
            className="w-full rounded-[28px] outline outline-1 -outline-offset-1 outline-black/10"
          />
        </div>
      </section>

      <section className="mt-24 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div data-reveal>
          <div className="eyebrow mb-4">Scoring</div>
          <h2 className="text-[36px] leading-[1.1] sm:text-[44px]">Deterministic and explainable</h2>
          <p className="mt-5 text-[15.5px] leading-[1.55] text-charcoal">
            The AI never decides the rank. It only labels evidence. The score is plain arithmetic over those labels, so the
            same inputs always give the same output, and every card on the dashboard shows its own math.
          </p>
          <div className="card mt-7 p-7">
            <div className="micro mb-4">Type weights</div>
            <div className="space-y-3">
              {types.map(([t, w]) => (
                <div key={t} className="grid grid-cols-[110px_1fr_40px] items-center gap-3">
                  <span className="text-[14px] text-charcoal">{TYPE_LABEL[t]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-canvas">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${w * 100}%`, opacity: 0.25 + w * 0.75 }} />
                  </span>
                  <span className="tnum text-right text-[14px] font-medium">{w.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div data-reveal className="card min-w-0 overflow-hidden">
          <RecencyChart />
          <pre className="tnum overflow-x-auto border-t border-line bg-lifted p-7 font-sans text-[13.5px] leading-[1.85] text-charcoal">
            {`signal_value = relevance × type_weight × recency   (is_about_vc = true only)
base         = max(signal_value) + min(0.15, 0.05 × (active_count − 1))

passed                                  → 0
waiting_for_response, contacted < 7d    → cap 0.40   ("give them time")
waiting_for_response, ≥ 14d + active    → +0.10      ("nudge, reference signal")

follow_up_score = round(100 × clamp(base, 0, 1))
Reach out this week  : score ≥ 60 AND an active (≤ 30d) signal
Warm — watch         : 25–59, or only cooling signals
Quiet — deprioritize : otherwise`}
          </pre>
        </div>
      </section>

      <section data-reveal className="mt-24 grid gap-4 md:grid-cols-3">
        <WindowCard color="var(--color-go)" range="0–30 days" title="Active" body="Only these can put an investor in Reach out this week. This is the brief's 30-day rule, applied literally." />
        <WindowCard color="var(--color-watch-ring)" range="31–60 days" title="Cooling" body="Still shown, with a lower score and a Warm — watch tag. A deal from 6 weeks ago is context, not a reason to email today." />
        <WindowCard color="var(--color-rest)" range="Over 60 days" title="History" body="Kept forever in signals for context and last_signal_date, but it never adds to the score." />
      </section>
      <p data-reveal className="mt-5 max-w-3xl text-[14.5px] leading-[1.55] text-slate">
        Why look back 60 days if only 30 count? Investors post in bursts. A wider window means the cooling list shows who is
        likely to resurface, and it gives each run a small overlap, so a source being down for a day doesn&apos;t lose
        signals.
      </p>

      <section className="mt-24">
        <div data-reveal>
          <div className="eyebrow mb-4" style={{ ["--dot" as string]: "var(--color-go)" }}>
            Safeguards
          </div>
          <h2 className="text-[36px] leading-[1.1] sm:text-[44px]">Vikram&apos;s notes are untouchable</h2>
        </div>
        <div data-reveal className="mt-8 grid gap-4 md:grid-cols-3">
          <Guard t="Column GRANTs" d="The server key may UPDATE only last_signal_date, signal_summary, follow_up_score and recommended_action. Writing personal_notes fails in Postgres with permission denied, whatever the app code does." />
          <Guard t="Single write path" d="Every vcs write goes through one RPC, update_vc_signals(). Seeding is insert-only (ON CONFLICT DO NOTHING), so re-seeding can't overwrite anything either." />
          <Guard t="Fingerprint proof" d="An md5 of all manual columns is taken before and after each run and stored in runs.protected_check. The dashboard shows ✓ only when the hashes match." />
        </div>
        <div data-reveal className="mt-4 grid gap-4 md:grid-cols-2">
          <Guard t="No hallucinated signals" d="URLs and dates always come from the source, never from the model. Gemini sees only fetched text and is told not to use outside knowledge. Unclassified items are never stored as signals." />
          <Guard t="Gemini Flash only" d="All AI in the repo is Gemini Flash (a fallback chain within the Flash family), using structured JSON output. No other AI SDKs are installed." />
        </div>
      </section>
    </div>
  );
}

function RecencyChart() {
  const W = 560;
  const H = 190;
  const P = 34;
  const x = (d: number) => P + (d / 70) * (W - 2 * P);
  const y = (v: number) => H - P - v * (H - 2 * P);
  return (
    <div className="p-7">
      <div className="micro mb-4">Recency multiplier by signal age</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Recency multiplier falls from 1.0 at day 0 to 0.7 at day 30, drops to 0.4 at day 31, falls to 0.1 at day 60, then 0."
      >
        <rect x={x(0)} y={P - 10} width={x(30) - x(0)} height={H - 2 * P + 10} rx="10" fill="rgb(31 122 82 / 0.06)" />
        <rect x={x(30)} y={P - 10} width={x(60) - x(30)} height={H - 2 * P + 10} rx="10" fill="rgb(217 147 13 / 0.08)" />
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="rgb(20 20 19 / 0.08)" />
            <text x={P - 8} y={y(v) + 4} textAnchor="end" className="fill-slate text-[11px]">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 30, 60].map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-slate text-[11px]">
            {d}d
          </text>
        ))}
        <path d={`M${x(0)} ${y(1)} L${x(30)} ${y(0.7)}`} stroke="var(--color-go)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d={`M${x(30)} ${y(0.7)} L${x(30)} ${y(0.4)}`} stroke="rgb(20 20 19 / 0.25)" strokeDasharray="3 3" />
        <path d={`M${x(30)} ${y(0.4)} L${x(60)} ${y(0.1)}`} stroke="var(--color-watch-ring)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d={`M${x(60)} ${y(0.1)} L${x(60)} ${y(0)} L${x(70)} ${y(0)}`} stroke="var(--color-rest)" strokeWidth="2" fill="none" />
        <text x={x(15)} y={y(0.85) - 12} textAnchor="middle" className="fill-go text-[11px] font-bold tracking-wider">
          ACTIVE
        </text>
        <text x={x(45)} y={y(0.25) - 12} textAnchor="middle" className="fill-watch text-[11px] font-bold tracking-wider">
          COOLING
        </text>
      </svg>
    </div>
  );
}

function WindowCard({ color, range, title, body }: { color: string; range: string; title: string; body: string }) {
  return (
    <div className="card p-7">
      <div className="eyebrow" style={{ ["--dot" as string]: color }}>
        {range}
      </div>
      <h3 className="mt-5 text-[28px] leading-none">{title}</h3>
      <p className="mt-4 text-[14.5px] leading-[1.55] text-charcoal">{body}</p>
    </div>
  );
}

function Guard({ t, d }: { t: string; d: string }) {
  return (
    <div className="card p-7">
      <h3 className="text-[19px] leading-tight">{t}</h3>
      <p className="mt-3 text-[14.5px] leading-[1.55] text-charcoal">{d}</p>
    </div>
  );
}
