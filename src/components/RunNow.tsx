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
        <div className="w-full min-w-0 sm:min-w-[220px]" role="status" aria-live="polite">
          <div className="mb-2 flex items-center justify-between text-[12.5px] text-charcoal">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-go" />
              </span>
              {scoring ? "Scoring & writing" : `Collecting signals ${done}/${total}`}
            </span>
            <span className="tnum text-slate">+{run?.signals_new ?? 0} new</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ghost">
            <div className="h-full rounded-full bg-go transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => (token ? start(token) : setOpen(true))} className="btn btn-ink">
          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden className="translate-x-px">
            <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
          </svg>
          Run now
        </button>
      )}
      {msg && !polling && <div className="mt-2 text-right text-[12.5px] text-slate">{msg}</div>}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (token) start(token);
          }}
          className="absolute right-0 top-full z-50 mt-3 w-[300px] rounded-[24px] border border-line bg-surface p-5 shadow-lift"
        >
          <label className="micro mb-2 block" htmlFor="admin-token">
            Admin token
          </label>
          <input
            id="admin-token"
            type="password"
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-10 w-full rounded-full border border-line bg-canvas px-4 text-[14px] outline-none transition-[border-color] duration-150 focus:border-ink/40"
            placeholder="ADMIN_TOKEN"
          />
          <p className="mt-3 text-[13px] leading-[1.45] text-slate">
            Runs ingest (Google News, GDELT, RSS, Firecrawl), then Gemini Flash, then scoring. Takes a few minutes.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn px-4 text-slate hover:text-ink">
              Cancel
            </button>
            <button type="submit" className="btn btn-ink">
              Start run
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
