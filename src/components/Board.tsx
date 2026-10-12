"use client";

import { useMemo, useState } from "react";
import type { VcView } from "@/lib/dashboard";
import { BUCKET_META } from "@/lib/format";
import type { Bucket, ContactStatus } from "@/lib/types";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
import { QuietRow, VcCard } from "./VcCard";

type FilterKey = "all" | ContactStatus;
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "yet_to_reach_out", label: "Not contacted" },
  { key: "waiting_for_response", label: "Awaiting reply" },
  { key: "in_conversation", label: "In conversation" },
];

export function Board({ vcs }: { vcs: VcView[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [showQuiet, setShowQuiet] = useState(false);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return vcs.filter(
      (v) =>
        (filter === "all" || v.status === filter) &&
        (!needle || `${v.name} ${v.firm} ${v.focusTags.join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [vcs, filter, q]);

  const by = (b: Bucket) =>
    visible
      .filter((v) => v.bucket === b)
      .sort((a, z) => (z.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(z.name));
  const reach = by("reach_out");
  const warm = by("warm");
  const quiet = by("quiet");

  return (
    <div>
      {/* Controls */}
      <div data-reveal className="mb-14">
        <div className="flex flex-col gap-3 rounded-[28px] border border-line bg-lifted p-2 sm:flex-row sm:items-center sm:justify-between sm:rounded-full">
          <div className="flex min-w-0 gap-0.5 overflow-x-auto [scrollbar-width:none]" data-lenis-prevent>
            <AnimatedBackground
              defaultValue="all"
              onValueChange={(id) => setFilter((id as FilterKey) ?? "all")}
              className="rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              {FILTERS.map((f) => {
                const n = f.key === "all" ? vcs.length : vcs.filter((v) => v.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    data-id={f.key}
                    type="button"
                    aria-pressed={filter === f.key}
                    className="flex min-h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-medium tracking-[-0.01em] text-slate transition-colors duration-150 data-[checked=true]:text-ink"
                  >
                    <span className="flex items-center gap-2">
                      {f.label}
                      <span className="tnum text-[12px] text-rest">{n}</span>
                    </span>
                  </button>
                );
              })}
            </AnimatedBackground>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">Search investors</span>
            <svg viewBox="0 0 16 16" width="15" height="15" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate" aria-hidden>
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, firm or focus"
              className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate focus:border-ink/40 focus:shadow-[0_0_0_4px_rgb(20_20_19/0.06)]"
            />
          </label>
        </div>
      </div>

      <Section bucket="reach_out" count={reach.length}>
        {reach.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {reach.map((v, i) => (
              <VcCard key={v.id} vc={v} rank={i + 1} variant="feature" />
            ))}
          </div>
        ) : (
          <Empty text="No one clears the bar this week: no strong, relevant signal from the last 30 days. Check Warm below." />
        )}
      </Section>

      <Section bucket="warm" count={warm.length}>
        {warm.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {warm.map((v, i) => (
              <VcCard key={v.id} vc={v} rank={reach.length + i + 1} variant="compact" />
            ))}
          </div>
        ) : (
          <Empty text="No warm investors right now." />
        )}
      </Section>

      <Section bucket="quiet" count={quiet.length}>
        <div className="card px-5 py-1 sm:px-7">
          {(showQuiet ? quiet : quiet.slice(0, 8)).map((v) => (
            <QuietRow key={v.id} vc={v} />
          ))}
          {quiet.length === 0 && <div className="py-8 text-center text-[14px] text-slate">Everyone has made some noise.</div>}
        </div>
        {quiet.length > 8 && (
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={() => setShowQuiet((s) => !s)} className="btn btn-ghost">
              {showQuiet ? "Show fewer" : `Show all ${quiet.length} quiet investors`}
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ bucket, count, children }: { bucket: Bucket; count: number; children: React.ReactNode }) {
  const m = BUCKET_META[bucket];
  return (
    <section className="mb-24 scroll-mt-40" id={bucket}>
      <div data-reveal className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="eyebrow mb-4" style={{ ["--dot" as string]: m.color }}>
            {m.kicker} · {bucket === "reach_out" ? "This week" : bucket === "warm" ? "Watch list" : "Deprioritized"}
          </div>
          <h2 className="flex items-baseline gap-3 text-[34px] leading-[1.1] sm:text-[44px]">
            {m.title}
            <span className="tnum text-[22px] text-taupe sm:text-[26px]">{count}</span>
          </h2>
        </div>
        <p className="max-w-sm text-[14.5px] leading-[1.5] text-slate lg:text-right">{m.blurb}</p>
      </div>
      <div data-reveal>{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card px-8 py-12 text-center text-[15px] text-slate">{text}</div>;
}
