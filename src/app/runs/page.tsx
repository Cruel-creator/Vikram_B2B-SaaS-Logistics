import { CheckIcon } from "@/components/ui";
import { duration, fmtDateTime, relTime } from "@/lib/format";
import { db } from "@/lib/supabase";
import type { RunRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Run log — Pipeline Intel" };

async function getRuns(): Promise<RunRow[]> {
  if (!process.env.SUPABASE_SECRET_KEY) return [];
  const { data } = await db().from("runs").select("*").order("started_at", { ascending: false }).limit(60);
  return (data ?? []) as RunRow[];
}

const STATUS_STYLE: Record<RunRow["status"], string> = {
  success: "text-ok border-ok/30 bg-ok/[0.07]",
  partial: "text-warm border-warm/30 bg-warm/[0.07]",
  failed: "text-bad border-bad/30 bg-bad/[0.07]",
  running: "text-reach border-reach/30 bg-reach/[0.07]",
};

export default async function RunsPage() {
  const runs = await getRuns();
  const ok = runs.filter((r) => r.protected_check?.unchanged).length;
  const finished = runs.filter((r) => r.status !== "running").length;

  return (
    <div className="pt-12 sm:pt-16">
      <div className="eyebrow mb-4">Audit log</div>
      <h1 className="font-display text-[48px] leading-none tracking-tight sm:text-[64px]">
        Every run, <span className="italic text-muted">on the record.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
        Ingest runs daily at 06:00 IST and scoring runs Monday and Thursday at 07:00 IST, via Vercel Cron. Each run fingerprints
        Vikram&apos;s manual columns (status, last contact, history, notes) before and after. Matching hashes prove the
        pipeline didn&apos;t touch them.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Kpi label="Runs logged" value={runs.length} />
        <Kpi label="Manual columns verified unchanged" value={`${ok}/${finished}`} accent />
        <Kpi label="Signals discovered (last 60 runs)" value={runs.reduce((a, r) => a + (r.signals_new ?? 0), 0)} />
      </div>

      <div className="card mt-8 overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_0.6fr_0.6fr_1.2fr] gap-4 border-b border-line px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint lg:grid">
          <span>Started (IST)</span>
          <span>Kind</span>
          <span>Status</span>
          <span className="text-right">VCs</span>
          <span className="text-right">New</span>
          <span className="text-right">Time</span>
          <span>Manual columns</span>
        </div>
        {runs.length === 0 && <div className="px-5 py-12 text-center text-[14px] text-faint">No runs yet.</div>}
        {runs.map((r) => (
          <details key={r.id} className="group border-b border-line last:border-0">
            <summary className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-white/[0.02] lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_0.6fr_0.6fr_1.2fr] lg:items-center">
              <span>
                <span className="block text-[14px] text-fg">{fmtDateTime(r.started_at)}</span>
                <span className="font-mono text-[11px] text-faint">{relTime(r.started_at)}</span>
              </span>
              <span className="font-mono text-[12px] text-muted">
                {r.kind} <span className="text-faint">· {r.trigger}</span>
              </span>
              <span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${STATUS_STYLE[r.status]}`}>
                  {r.status === "running" && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />}
                  {r.status}
                </span>
              </span>
              <span className="font-mono text-[13px] tabular-nums text-fg lg:text-right">
                {r.vcs_processed ?? 0}
                <span className="text-faint">/{r.vcs_total ?? "–"}</span>
              </span>
              <span className="font-mono text-[13px] tabular-nums text-fg lg:text-right">+{r.signals_new ?? 0}</span>
              <span className="font-mono text-[12px] tabular-nums text-muted lg:text-right">{duration(r.started_at, r.finished_at)}</span>
              <span className="col-span-2 lg:col-span-1">
                {r.protected_check?.unchanged ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ok">
                    <CheckIcon /> Unchanged
                    <span className="font-mono text-[10.5px] text-faint">{r.protected_check.after_hash?.slice(0, 10)}</span>
                  </span>
                ) : r.protected_check?.after_hash ? (
                  <span className="text-[12.5px] text-bad">Changed (edited during run?)</span>
                ) : (
                  <span className="text-[12.5px] text-faint">pending</span>
                )}
              </span>
            </summary>
            <div className="grid gap-4 bg-white/[0.012] px-5 py-4 text-[12px] lg:grid-cols-2">
              <div className="space-y-1 font-mono text-muted">
                <div>
                  run id <span className="text-faint">{r.id}</span>
                </div>
                <div>
                  before <span className="text-faint">{r.protected_check?.before_hash ?? "—"}</span>
                </div>
                <div>
                  after&nbsp; <span className="text-faint">{r.protected_check?.after_hash ?? "—"}</span>
                </div>
                <div>
                  firecrawl credits <span className="text-faint">{r.firecrawl_credits ?? 0}</span>
                </div>
              </div>
              <div>
                <div className="eyebrow mb-1.5">Non-fatal errors ({r.errors?.length ?? 0})</div>
                {(r.errors ?? []).length === 0 ? (
                  <div className="text-faint">None</div>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-auto font-mono text-[11px] text-muted">
                    {r.errors.slice(0, 40).map((e, i) => (
                      <li key={i}>
                        <span className="text-warm">[{e.source}]</span> {e.vc ? <span className="text-fg/80">{e.vc}: </span> : null}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 font-display text-[44px] leading-none tabular-nums ${accent ? "text-ok" : ""}`}>{value}</div>
    </div>
  );
}
