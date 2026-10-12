"use client";

import type { VcView } from "@/lib/dashboard";
import { fmtDate, SOURCE_LABEL } from "@/lib/format";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import { NotesEditor } from "./NotesEditor";
import { ArrowUpRight, Monogram, ScoreRing, StatusPill, TypeBadge, WindowTag } from "./ui";

export function VcCard({
  vc,
  rank,
  variant,
  onOutreach,
}: {
  vc: VcView;
  rank: number;
  variant: "feature" | "compact";
  onOutreach: (id: string) => void;
}) {
  const feature = variant === "feature";
  const body = <CardBody vc={vc} rank={rank} feature={feature} onOutreach={onOutreach} />;

  if (feature) {
    return (
      <SpotlightCard
        theme="light"
        spotlightColor="#F37338"
        intensity={0.22}
        spotlightSize={320}
        borderGlow={0.5}
        flare={false}
        className="card-lift h-full rounded-[40px]"
        style={{ "--spotlight-card-shadow": "none" } as React.CSSProperties}
      >
        {body}
      </SpotlightCard>
    );
  }
  return <article className="card card-lift h-full">{body}</article>;
}

function CardBody({ vc, rank, feature, onOutreach }: { vc: VcView; rank: number; feature: boolean; onOutreach: (id: string) => void }) {
  const evidence = vc.evidence.slice(0, feature ? 3 : 2);
  return (
    <div className={`flex h-full flex-col ${feature ? "p-7 sm:p-8" : "p-6 sm:p-7"}`}>
      {/* Identity */}
      <div className="flex items-start gap-4">
        <Monogram name={vc.name} href={vc.linkedinUrl ?? vc.firmWebsite} size={feature ? 56 : 48} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="micro mb-1 flex items-center gap-2">
            <span className="tnum text-taupe">{String(rank).padStart(2, "0")}</span>
            <span className="truncate">{vc.firm}</span>
          </div>
          <h3 className={`truncate leading-[1.1] ${feature ? "text-[26px]" : "text-[22px]"}`}>{vc.name}</h3>
          <p className="mt-1 truncate text-[13.5px] text-slate">
            {vc.role}
            {vc.location ? ` · ${vc.location}` : ""}
          </p>
        </div>
        <ScoreRing score={vc.score} bucket={vc.bucket} size={feature ? 64 : 52} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <StatusPill status={vc.status} lastContactDate={vc.lastContactDate} />
        {vc.focusTags.slice(0, feature ? 3 : 2).map((t) => (
          <span key={t} className="inline-flex h-7 items-center rounded-full border border-line px-3 text-[12px] text-slate">
            {t}
          </span>
        ))}
      </div>

      {/* Next move */}
      {vc.recommendedAction && (
        <div className="mt-5 rounded-[20px] bg-canvas p-5">
          <div className="eyebrow mb-2 text-[11.5px]" style={{ ["--dot" as string]: "var(--color-go)" }}>
            Next move
          </div>
          <p className={`${feature ? "text-[16px]" : "text-[15px]"} leading-[1.45] text-ink`}>{vc.recommendedAction}</p>
        </div>
      )}

      {/* Why now */}
      {vc.signalSummary && (
        <div className="mt-5">
          <div className="micro mb-1.5">Why now</div>
          <p className="text-[14px] leading-[1.5] text-charcoal">{vc.signalSummary}</p>
        </div>
      )}

      {/* Evidence */}
      {evidence.length > 0 && (
        <div className="mt-5">
          <div className="micro mb-3 flex items-center justify-between">
            <span>Evidence</span>
            <span className="tnum normal-case tracking-normal">
              {vc.activeCount} active · {vc.coolingCount} cooling
            </span>
          </div>
          <ol className="relative space-y-4 border-l border-line pl-5">
            {evidence.map((e) => (
              <li key={e.url} className="relative">
                <span
                  className="absolute -left-[25px] top-2 h-[9px] w-[9px] rounded-full ring-4 ring-surface"
                  style={{ background: e.window === "active" ? "var(--color-go)" : "var(--color-watch-ring)" }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={e.type} />
                  <WindowTag window={e.window} ageDays={e.ageDays} />
                </div>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-start gap-1.5 text-[14px] leading-snug text-ink"
                >
                  <span className="link-underline line-clamp-2">{e.headline}</span>
                  <ArrowUpRight className="mt-1 shrink-0 text-slate" />
                </a>
                <div className="tnum mt-1 text-[12px] text-slate">
                  {e.publisher} · {fmtDate(e.publishedAt, { day: "numeric", month: "short", year: "numeric" })} · via{" "}
                  {SOURCE_LABEL[e.source] ?? e.source}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Vikram's notes (editable) + outreach */}
      <div className="mt-auto pt-6">
        <NotesEditor
          vcId={vc.id}
          notes={vc.personalNotes}
          history={vc.contactHistory}
          status={vc.status}
          lastContactDate={vc.lastContactDate}
        />
        <button type="button" onClick={() => onOutreach(vc.id)} className="btn btn-ink mt-4 w-full">
          Draft outreach
          <ArrowUpRight />
        </button>
      </div>
    </div>
  );
}

export function QuietRow({ vc, onOutreach }: { vc: VcView; onOutreach: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-line py-3.5 last:border-0 sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto_auto_auto_auto]">
      <Monogram name={vc.name} size={36} />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium tracking-[-0.01em]">{vc.name}</div>
        <div className="truncate text-[12.5px] text-slate sm:hidden">{vc.firm}</div>
      </div>
      <div className="hidden truncate text-[14px] text-slate sm:block">{vc.firm}</div>
      <div className="hidden sm:block">
        <StatusPill status={vc.status} lastContactDate={vc.lastContactDate} />
      </div>
      <div className="tnum hidden w-32 text-right text-[12.5px] text-slate sm:block">
        {vc.lastSignalDate ? `Last signal ${fmtDate(vc.lastSignalDate)}` : "No signal"}
      </div>
      <div className="tnum w-10 text-right text-[16px] font-medium text-rest">{vc.score ?? "–"}</div>
      <button
        type="button"
        onClick={() => onOutreach(vc.id)}
        className="rounded-full px-3 py-2 text-[13px] font-medium text-charcoal transition-colors duration-150 hover:bg-canvas hover:text-ink"
      >
        Outreach
      </button>
    </div>
  );
}
