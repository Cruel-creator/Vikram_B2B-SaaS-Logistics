"use client";

import { useMemo, useState } from "react";
import type { VcView } from "@/lib/dashboard";
import { BUCKET_META } from "@/lib/format";
import type { Bucket, ContactStatus } from "@/lib/types";
import { QuietRow, VcCard } from "./VcCard";

const FILTERS: Array<{ key: "all" | ContactStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "yet_to_reach_out", label: "Not contacted" },
  { key: "waiting_for_response", label: "Awaiting reply" },
  { key: "in_conversation", label: "In conversation" },
];

export function Board({ vcs }: { vcs: VcView[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
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
      <div className="sticky top-14 z-30 -mx-4 mb-8 border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => {
              const n = f.key === "all" ? vcs.length : vcs.filter((v) => v.status === f.key).length;
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                    on ? "border-fg bg-fg text-ink" : "border-line text-muted hover:border-line-strong hover:text-fg"
                  }`}
                >
                  {f.label} <span className={`font-mono text-[11px] ${on ? "text-ink/60" : "text-faint"}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Search investors</span>
            <svg viewBox="0 0 16 16" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden>
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, firm or focus…"
              className="w-full rounded-full border border-line bg-panel/80 py-2 pl-9 pr-3 text-[13px] text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
      </div>

      <Section bucket="reach_out" count={reach.length}>
        {reach.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {reach.map((v, i) => (
              <div key={v.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                <VcCard vc={v} rank={i + 1} variant="feature" />
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No one clears the bar this week. Nobody has a strong, relevant signal from the last 30 days — check Warm below." />
        )}
      </Section>

      <Section bucket="warm" count={warm.length}>
        {warm.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {warm.map((v, i) => (
              <div key={v.id} className="animate-rise" style={{ animationDelay: `${i * 35}ms` }}>
                <VcCard vc={v} rank={reach.length + i + 1} variant="compact" />
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No warm investors right now." />
        )}
      </Section>

      <Section bucket="quiet" count={quiet.length}>
        <div className="card px-4 py-1 sm:px-5">
          {(showQuiet ? quiet : quiet.slice(0, 8)).map((v) => (
            <QuietRow key={v.id} vc={v} />
          ))}
          {quiet.length === 0 && <div className="py-6 text-center text-sm text-faint">Everyone has made some noise.</div>}
        </div>
        {quiet.length > 8 && (
          <button
            onClick={() => setShowQuiet((s) => !s)}
            className="mx-auto mt-3 block rounded-full border border-line px-4 py-1.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            {showQuiet ? "Show fewer" : `Show all ${quiet.length} quiet investors`}
          </button>
        )}
      </Section>
    </div>
  );
}

function Section({ bucket, count, children }: { bucket: Bucket; count: number; children: React.ReactNode }) {
  const m = BUCKET_META[bucket];
  return (
    <section className="mb-14" id={bucket}>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] text-faint">{m.kicker}</span>
          <h2 className="font-display text-[34px] leading-none tracking-tight sm:text-[40px]">
            {m.title.split(" — ")[0]}
            {m.title.includes(" — ") && <span className="italic text-muted"> — {m.title.split(" — ")[1]}</span>}
          </h2>
          <span
            className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-mono text-[12px] font-medium"
            style={{ background: m.dim, color: m.color }}
          >
            {count}
          </span>
        </div>
        <p className="max-w-md text-[13px] text-faint sm:text-right">{m.blurb}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card px-6 py-10 text-center text-[14px] text-muted">{text}</div>;
}
