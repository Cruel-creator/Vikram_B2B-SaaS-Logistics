"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = {
  id: string;
  status: "running" | "success" | "partial" | "failed";
  stage: string | null;
  vcs_processed: number | null;
  vcs_total: number | null;
  signals_new: number | null;
};

const TOKEN_KEY = "vcpi_admin_token";

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function RunNow({ initiallyRunning }: { initiallyRunning: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [run, setRun] = useState<Status | null>(null);
  const [polling, setPolling] = useState(initiallyRunning);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setToken(readToken()), []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      const { run } = (await res.json()) as { run: Status | null };
      setRun(run);
      if (run && run.status !== "running") {
        setPolling(false);
        setMsg(run.status === "success" ? "Run complete" : `Run ${run.status}`);
        router.refresh();
      } else if (run?.stage?.startsWith("score")) {
        router.refresh();
      }
    } catch {
      /* transient */
    }
  }, [router]);

  useEffect(() => {
    if (!polling) return;
    poll();
    timer.current = setInterval(poll, 3500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [polling, poll]);

  async function start(t: string) {
    setMsg(null);
    const res = await fetch("/api/run", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401) {
      setMsg("Wrong admin token");
      setOpen(true);
      return;
    }
    if (res.status === 409) {
      setMsg("A run is already in progress");
      setPolling(true);
      return;
    }
    if (!res.ok) {
      setMsg(`Could not start (${res.status})`);
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* private mode */
    }
    setOpen(false);
    setPolling(true);
  }

  const stage = run?.stage ?? "";
  const scoring = stage.startsWith("score") || stage === "finalizing";
  const total = run?.vcs_total ?? 50;
  const done = run?.vcs_processed ?? 0;
  const pct = scoring ? 92 : Math.round((done / Math.max(1, total)) * 85) + 5;

  return (
    <div className="relative">
      {polling ? (
        <div className="w-full min-w-[220px]">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-reach" />
              {scoring ? "Scoring & writing" : `Collecting signals ${done}/${total}`}
            </span>
            <span>+{run?.signals_new ?? 0} new</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-reach transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => (token ? start(token) : setOpen(true))}
          className="group inline-flex items-center gap-2 rounded-full bg-reach px-4 py-2 text-[13px] font-medium text-ink shadow-[0_0_0_1px_rgb(212_255_63/0.4),0_8px_30px_-8px_rgb(212_255_63/0.5)] transition-transform hover:-translate-y-px active:translate-y-0"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
          </svg>
          Run now
        </button>
      )}
      {msg && !polling && <div className="mt-2 font-mono text-[11px] text-muted">{msg}</div>}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (token) start(token);
          }}
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line-strong bg-panel-2 p-4 shadow-2xl"
        >
          <label className="eyebrow mb-2 block" htmlFor="admin-token">
            Admin token
          </label>
          <input
            id="admin-token"
            type="password"
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-[12px] focus:border-line-strong focus:outline-none"
            placeholder="ADMIN_TOKEN"
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Runs ingest (Google News, GDELT, RSS, Firecrawl) → Gemini Flash → score. Takes a few minutes.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-[12px] text-muted hover:text-fg">
              Cancel
            </button>
            <button type="submit" className="rounded-full bg-fg px-3 py-1.5 text-[12px] font-medium text-ink">
              Start run
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
