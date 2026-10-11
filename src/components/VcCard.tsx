import type { VcView } from "@/lib/dashboard";
import { fmtDate, SOURCE_LABEL } from "@/lib/format";
import { ArrowUpRight, LockIcon, ScoreRing, StatusPill, TypeBadge, WindowTag } from "./ui";

export function VcCard({ vc, rank, variant }: { vc: VcView; rank: number; variant: "feature" | "compact" }) {
  const feature = variant === "feature";
  const evidence = vc.evidence.slice(0, feature ? 3 : 2);
  return (
    <article
      className="card card-hover group relative flex flex-col overflow-hidden p-5 sm:p-6"
      style={{ animationDelay: `${Math.min(rank, 12) * 45}ms` }}
    >
      {feature && (
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(212 255 63 / 0.10), transparent 70%)" }}
          aria-hidden
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[11px] text-faint tabular-nums">{String(rank).padStart(2, "0")}</span>
            <span className="h-px w-4 bg-line-strong" />
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{vc.firm}</span>
          </div>
          <h3 className={`font-display leading-[1.05] tracking-tight ${feature ? "text-[30px]" : "text-[24px]"}`}>
            {vc.linkedinUrl ? (
              <a href={vc.linkedinUrl} target="_blank" rel="noreferrer" className="link-underline">
                {vc.name}
              </a>
            ) : (
              vc.name
            )}
          </h3>
          <p className="mt-1 truncate text-[13px] text-muted">
            {vc.role}
            {vc.location ? <span className="text-faint"> · {vc.location}</span> : null}
          </p>
        </div>
        <ScoreRing score={vc.score} bucket={vc.bucket} size={feature ? 66 : 54} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusPill status={vc.status} lastContactDate={vc.lastContactDate} />
        {vc.focusTags.slice(0, feature ? 3 : 2).map((t) => (
          <span key={t} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">
            {t}
          </span>
        ))}
      </div>

      {/* Next move */}
      {vc.recommendedAction && (
        <div
          className="relative mt-5 rounded-xl border p-4"
          style={{
            borderColor: vc.bucket === "reach_out" ? "rgb(212 255 63 / 0.22)" : "var(--color-line)",
            background: vc.bucket === "reach_out" ? "rgb(212 255 63 / 0.045)" : "rgb(255 255 255 / 0.02)",
          }}
        >
          <div className="eyebrow mb-1.5" style={{ color: vc.bucket === "reach_out" ? "var(--color-reach)" : undefined }}>
            Next move
          </div>
          <p className={`${feature ? "text-[15px]" : "text-[14px]"} leading-relaxed text-fg`}>{vc.recommendedAction}</p>
        </div>
      )}

      {/* Why now */}
      {vc.signalSummary && (
        <div className="mt-4">
          <div className="eyebrow mb-1">Why now</div>
          <p className="text-[13.5px] leading-relaxed text-muted">{vc.signalSummary}</p>
        </div>
      )}

      {/* Evidence */}
      {evidence.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-2 flex items-center justify-between">
            <span>Evidence</span>
            <span className="normal-case tracking-normal">
              {vc.activeCount} active · {vc.coolingCount} cooling
            </span>
          </div>
          <ol className="relative space-y-2.5 border-l border-line pl-4">
            {evidence.map((e) => (
              <li key={e.url} className="relative">
                <span
                  className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-4 ring-ink"
                  style={{ background: e.window === "active" ? "var(--color-reach)" : "var(--color-warm)" }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={e.type} />
                  <WindowTag window={e.window} ageDays={e.ageDays} />
                </div>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-start gap-1 text-[13.5px] leading-snug text-fg/90 hover:text-fg"
                >
                  <span className="link-underline line-clamp-2">{e.headline}</span>
                  <ArrowUpRight className="mt-1 shrink-0 text-faint" />
                </a>
                <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                  {e.publisher} · {fmtDate(e.publishedAt, { day: "numeric", month: "short", year: "numeric" })} · via{" "}
                  {SOURCE_LABEL[e.source] ?? e.source}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes (read-only) + score math */}
      <div className="mt-auto pt-5">
        {(vc.personalNotes || vc.contactHistory) && (
          <div className="rounded-xl border border-dashed border-line bg-white/[0.012] p-3">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              <LockIcon /> Vikram&apos;s notes · read-only
            </div>
            {vc.personalNotes && <p className="text-[12.5px] italic leading-relaxed text-muted">{vc.personalNotes}</p>}
            {vc.contactHistory && <p className="mt-1 text-[12px] leading-relaxed text-faint">{vc.contactHistory}</p>}
          </div>
        )}
        <details className="group/d mt-3">
          <summary className="flex items-center gap-1.5 font-mono text-[10.5px] text-faint transition-colors hover:text-muted">
            <span className="inline-block transition-transform group-open/d:rotate-90">›</span> How this score was computed
          </summary>
          <ul className="mt-2 space-y-1 pl-3 font-mono text-[11px] leading-relaxed text-muted">
            {vc.explanation.map((x) => (
              <li key={x}>· {x}</li>
            ))}
            <li className="text-faint">· score = round(100 × clamp(base)) = {vc.score ?? "pending"}</li>
          </ul>
        </details>
      </div>
    </article>
  );
}

export function QuietRow({ vc }: { vc: VcView }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-1 py-3 last:border-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto_auto]">
      <div className="min-w-0">
        <div className="truncate text-[14px] text-fg">{vc.name}</div>
        <div className="truncate text-[12px] text-faint sm:hidden">{vc.firm}</div>
      </div>
      <div className="hidden truncate text-[13px] text-muted sm:block">{vc.firm}</div>
      <div className="hidden sm:block">
        <StatusPill status={vc.status} lastContactDate={vc.lastContactDate} />
      </div>
      <div className="hidden w-28 text-right font-mono text-[11px] text-faint sm:block">
        {vc.lastSignalDate ? `last ${fmtDate(vc.lastSignalDate)}` : "no signal"}
      </div>
      <div className="w-10 text-right font-mono text-[13px] tabular-nums text-quiet">{vc.score ?? "–"}</div>
    </div>
  );
}
