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
  success: "bg-go-tint text-go",
  partial: "bg-watch-tint text-watch",
  failed: "bg-[#FDECEA] text-bad",
  running: "bg-[#EAF0FB] text-link",
};

export default async function RunsPage() {
  const runs = await getRuns();
  const finished = runs.filter((r) => r.status !== "running");
  const ok = finished.filter((r) => r.protected_check?.unchanged).length;

  return (
    <div>
      <header className="grid gap-8 pb-12 pt-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <div data-reveal className="eyebrow mb-6">
            Audit log
          </div>
          <h1 data-reveal className="text-[46px] leading-[1] sm:text-[64px]">
            Every run, on the record.
          </h1>
        </div>
        <p data-reveal className="max-w-md text-[16px] leading-[1.55] text-charcoal">
          Ingest runs daily at 06:00 IST and scoring runs Monday and Thursday at 07:00 IST, via Vercel Cron. Each run fingerprints
          Vikram&apos;s manual columns before and after. Matching hashes prove the pipeline left them alone.
        </p>
      </header>

      <div data-reveal className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Runs logged" value={String(runs.length)} />
        <Kpi label="Manual columns verified unchanged" value={`${ok}/${finished.length}`} accent />
        <Kpi label="Signals discovered" value={String(runs.reduce((a, r) => a + (r.signals_new ?? 0), 0))} />
      </div>

      <div data-reveal className="card mt-6 overflow-hidden">
        <div className="micro hidden grid-cols-[1.3fr_0.8fr_0.8fr_0.5fr_0.5fr_0.5fr_1.2fr] gap-4 border-b border-line px-7 py-4 lg:grid">
          <span>Started (IST)</span>
          <span>Kind</span>
          <span>Status</span>
          <span className="text-right">VCs</span>
          <span className="text-right">New</span>
          <span className="text-right">Time</span>
          <span>Manual columns</span>
        </div>
        {runs.length === 0 && <div className="px-7 py-14 text-center text-[15px] text-slate">No runs yet.</div>}
        {runs.map((r) => (
          <details key={r.id} className="group border-b border-line last:border-0">
            <summary className="grid grid-cols-2 gap-x-4 gap-y-2 px-7 py-5 transition-colors duration-150 hover:bg-lifted lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.5fr_0.5fr_0.5fr_1.2fr] lg:items-center">
              <span>
                <span className="block text-[15px] font-medium tracking-[-0.01em]">{fmtDateTime(r.started_at)}</span>
                <span className="text-[12.5px] text-slate">{relTime(r.started_at)}</span>
              </span>
              <span className="text-[14px] text-charcoal">
                {r.kind} <span className="text-slate">· {r.trigger}</span>
              </span>
              <span>
                <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ${STATUS_STYLE[r.status]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full bg-current ${r.status === "running" ? "animate-pulse" : ""}`} />
                  {r.status}
                </span>
              </span>
              <span className="tnum text-[15px] lg:text-right">
                {r.vcs_processed ?? 0}
                <span className="text-taupe">/{r.vcs_total ?? "–"}</span>
              </span>
              <span className="tnum text-[15px] lg:text-right">+{r.signals_new ?? 0}</span>
              <span className="tnum text-[14px] text-charcoal lg:text-right">{duration(r.started_at, r.finished_at)}</span>
              <span className="col-span-2 lg:col-span-1">
                {r.protected_check?.unchanged ? (
                  <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-go">
                    <CheckIcon /> Unchanged
                    <span className="tnum font-normal text-slate">{r.protected_check.after_hash?.slice(0, 10)}</span>
                  </span>
                ) : r.protected_check?.after_hash ? (
                  <span className="text-[13.5px] text-bad">Changed (edited during run?)</span>
                ) : (
                  <span className="text-[13.5px] text-slate">Pending</span>
                )}
              </span>
            </summary>
            <div className="grid gap-6 bg-lifted px-7 py-5 text-[13px] lg:grid-cols-2">
              <dl className="tnum space-y-1.5 text-charcoal">
                <div>
                  <dt className="micro inline">Run id </dt>
                  <dd className="inline text-slate">{r.id}</dd>
                </div>
                <div>
                  <dt className="micro inline">Before </dt>
                  <dd className="inline text-slate">{r.protected_check?.before_hash ?? "—"}</dd>
                </div>
                <div>
                  <dt className="micro inline">After </dt>
                  <dd className="inline text-slate">{r.protected_check?.after_hash ?? "—"}</dd>
                </div>
                <div>
                  <dt className="micro inline">Firecrawl credits </dt>
                  <dd className="inline text-slate">{r.firecrawl_credits ?? 0}</dd>
                </div>
              </dl>
              <div>
                <div className="micro mb-2">Non-fatal errors ({r.errors?.length ?? 0})</div>
                {(r.errors ?? []).length === 0 ? (
                  <div className="text-slate">None</div>
                ) : (
                  <ul className="max-h-52 space-y-1 overflow-auto text-[12.5px] text-charcoal" data-lenis-prevent>
                    {r.errors.slice(0, 40).map((e, i) => (
                      <li key={i}>
                        <span className="font-medium text-watch">[{e.source}]</span> {e.vc ? <span>{e.vc}: </span> : null}
                        <span className="text-slate">{e.message}</span>
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

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-7">
      <div className="micro">{label}</div>
      <div className={`tnum mt-3 text-[48px] font-medium leading-none tracking-[-0.03em] ${accent ? "text-go" : ""}`}>{value}</div>
    </div>
  );
}
