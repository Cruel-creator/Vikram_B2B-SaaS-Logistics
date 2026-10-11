import { TYPE_WEIGHT } from "@/lib/scoring";
import { TYPE_LABEL } from "@/lib/format";
import type { SignalType } from "@/lib/types";

export const metadata = { title: "How it works — Pipeline Intel" };

const STEPS = [
  {
    n: "01",
    t: "Collect",
    d: "Every day at 06:00 IST, live sources are queried for each investor: Google News RSS (name + firm, plus the firm's recent deals), GDELT, and the investor's own blog/Substack feed. Anything without a real URL and a published date is dropped.",
  },
  {
    n: "02",
    t: "Verify",
    d: "Gemini Flash reads only the fetched text and labels each item: is it really about this person at this firm (namesakes rejected), what kind of signal it is, how relevant it is to Seed-stage B2B logistics SaaS, and a ≤25-word factual summary.",
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
    <div className="pt-12 sm:pt-16">
      <div className="eyebrow mb-4">Method</div>
      <h1 className="max-w-4xl font-display text-[48px] leading-[0.98] tracking-tight sm:text-[68px]">
        Observable signals in, <span className="italic text-muted">a short list out.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-[15.5px] leading-relaxed text-muted">
        Vikram is a first-time founder raising a Seed round for a B2B logistics SaaS. He tracks around 50 VCs. Twice a week
        this tells him <span className="text-fg">who is worth reaching out to this week and why</span>, based on something
        each investor wrote, said, invested in or appeared at in the past 30 days. It also flags who has gone quiet.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="card p-6">
            <div className="font-mono text-[11px] text-reach">{s.n}</div>
            <h3 className="mt-3 font-display text-[28px] leading-none">{s.t}</h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{s.d}</p>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Architecture</div>
            <h2 className="font-display text-[40px] leading-none tracking-tight">Components Map</h2>
          </div>
          <a href="/components-map.svg" target="_blank" className="font-mono text-[12px] text-faint hover:text-muted">
            Open SVG ↗
          </a>
        </div>
        <div className="card overflow-hidden p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/components-map.svg" alt="Components map of the VC pipeline intelligence system" className="w-full rounded-[14px]" />
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="eyebrow mb-2">Scoring</div>
          <h2 className="font-display text-[40px] leading-none tracking-tight">Deterministic and explainable</h2>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            The AI never decides the rank. It only labels evidence. The score is plain arithmetic over those labels, so the
            same inputs always give the same output, and every card on the dashboard shows its own math.
          </p>
          <div className="card mt-6 p-5">
            <div className="eyebrow mb-3">Type weights</div>
            <div className="space-y-2">
              {types.map(([t, w]) => (
                <div key={t} className="grid grid-cols-[110px_1fr_40px] items-center gap-3">
                  <span className="text-[13px] text-muted">{TYPE_LABEL[t]}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <span className="block h-full rounded-full bg-reach" style={{ width: `${w * 100}%`, opacity: 0.35 + w * 0.65 }} />
                  </span>
                  <span className="text-right font-mono text-[12px] tabular-nums">{w.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <RecencyChart />
          <pre className="overflow-x-auto border-t border-line p-6 font-mono text-[12px] leading-[1.8] text-muted">
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

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <WindowCard color="var(--color-reach)" range="0–30 days" title="Active" body="Only these can put an investor in Reach out this week. This is the brief's 30-day rule, applied literally." />
        <WindowCard color="var(--color-warm)" range="31–60 days" title="Cooling" body="Still shown, with a lower score and a Warm — watch tag. A deal from 6 weeks ago is context, not a reason to email today." />
        <WindowCard color="var(--color-quiet)" range="> 60 days" title="History" body="Kept forever in signals for context and last_signal_date, but it never adds to the score." />
      </section>
      <p className="mt-4 max-w-3xl text-[13.5px] leading-relaxed text-faint">
        Why look back 60 days if only 30 count? Investors post in bursts. A wider window means the cooling list shows who is
        likely to resurface, and it gives each run a small overlap, so a source being down for a day doesn&apos;t lose
        signals.
      </p>

      <section className="mt-16">
        <div className="eyebrow mb-2">Safeguards</div>
        <h2 className="font-display text-[40px] leading-none tracking-tight">Vikram&apos;s notes are untouchable</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Guard t="Column GRANTs" d="The server key may UPDATE only last_signal_date, signal_summary, follow_up_score and recommended_action. Writing personal_notes fails in Postgres with permission denied, whatever the app code does." />
          <Guard t="Single write path" d="Every vcs write goes through one RPC, update_vc_signals(). Seeding is insert-only (ON CONFLICT DO NOTHING), so re-seeding can't overwrite anything either." />
          <Guard t="Fingerprint proof" d="An md5 of all manual columns is taken before and after each run and stored in runs.protected_check. The dashboard shows ✓ only when the hashes match." />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Guard t="No hallucinated signals" d="URLs and dates always come from the source, never from the model. Gemini sees only fetched text and is told not to use outside knowledge. Unclassified items are never stored as signals." />
          <Guard t="Gemini Flash only" d="All AI in the repo is Gemini Flash (fallback chain within the Flash family), using structured JSON output. No other AI SDKs are installed." />
        </div>
      </section>
    </div>
  );
}

function RecencyChart() {
  const W = 560;
  const H = 180;
  const P = 32;
  const x = (d: number) => P + (d / 70) * (W - 2 * P);
  const y = (v: number) => H - P - v * (H - 2 * P);
  return (
    <div className="p-6">
      <div className="eyebrow mb-3">Recency multiplier by signal age</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Recency multiplier falls from 1.0 at day 0 to 0.7 at day 30, drops to 0.4 at day 31, falls to 0.1 at day 60, then 0."
      >
        <rect x={x(0)} y={P - 8} width={x(30) - x(0)} height={H - 2 * P + 8} fill="rgb(212 255 63 / 0.05)" />
        <rect x={x(30)} y={P - 8} width={x(60) - x(30)} height={H - 2 * P + 8} fill="rgb(255 181 71 / 0.05)" />
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.06)" />
            <text x={P - 8} y={y(v) + 4} textAnchor="end" className="fill-faint font-mono text-[10px]">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 30, 60].map((d) => (
          <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="fill-faint font-mono text-[10px]">
            {d}d
          </text>
        ))}
        <path d={`M${x(0)} ${y(1)} L${x(30)} ${y(0.7)}`} stroke="var(--color-reach)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d={`M${x(30)} ${y(0.7)} L${x(30)} ${y(0.4)}`} stroke="rgb(255 255 255 / 0.2)" strokeDasharray="3 3" />
        <path d={`M${x(30)} ${y(0.4)} L${x(60)} ${y(0.1)}`} stroke="var(--color-warm)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d={`M${x(60)} ${y(0.1)} L${x(60)} ${y(0)} L${x(70)} ${y(0)}`} stroke="var(--color-quiet)" strokeWidth="2" fill="none" />
        <text x={x(15)} y={y(0.85) - 10} textAnchor="middle" className="fill-reach font-mono text-[10.5px]">
          ACTIVE
        </text>
        <text x={x(45)} y={y(0.25) - 10} textAnchor="middle" className="fill-warm font-mono text-[10.5px]">
          COOLING
        </text>
      </svg>
    </div>
  );
}

function WindowCard({ color, range, title, body }: { color: string; range: string; title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="font-mono text-[12px]" style={{ color }}>
          {range}
        </span>
      </div>
      <h3 className="mt-3 font-display text-[30px] leading-none">{title}</h3>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Guard({ t, d }: { t: string; d: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-[15px] font-medium text-fg">{t}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{d}</p>
    </div>
  );
}
