import type { Bucket, ContactStatus, SignalType } from "@/lib/types";
import { BUCKET_META, STATUS_LABEL, TYPE_LABEL } from "@/lib/format";

export function ScoreRing({ score, bucket, size = 64 }: { score: number | null; bucket: Bucket; size?: number }) {
  const stroke = size >= 60 ? 4 : 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const color = BUCKET_META[bucket].color;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Follow-up score ${score ?? "pending"} of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ghost)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[19px] font-medium leading-none tracking-[-0.02em]">{score ?? "–"}</span>
        {size >= 60 && <span className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate">Score</span>}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<ContactStatus, string> = {
  yet_to_reach_out: "bg-canvas text-charcoal",
  waiting_for_response: "bg-[#EAF0FB] text-link",
  in_conversation: "bg-go-tint text-go",
  passed: "bg-canvas text-slate line-through",
};

export function StatusPill({ status, lastContactDate }: { status: ContactStatus; lastContactDate?: string | null }) {
  const days = lastContactDate ? Math.floor((Date.now() - Date.parse(lastContactDate)) / 86_400_000) : null;
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ${STATUS_TONE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
      {status === "waiting_for_response" && days !== null && <span className="tnum opacity-75">· {days}d</span>}
    </span>
  );
}

const TYPE_TONE: Record<SignalType, string> = {
  investment: "bg-ink text-canvas",
  blog_post: "bg-[#EAF0FB] text-link",
  interview: "bg-[#F1ECFA] text-[#5B3FA6]",
  event: "bg-watch-tint text-watch",
  social_post: "bg-[#FBEDF3] text-[#A23863]",
  news_mention: "bg-canvas text-charcoal",
  other: "bg-canvas text-slate",
};

export function TypeBadge({ type }: { type: SignalType }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-[6px] px-2 text-[11px] font-bold uppercase tracking-[0.05em] ${TYPE_TONE[type]}`}>
      {TYPE_LABEL[type]}
    </span>
  );
}

export function WindowTag({ window, ageDays }: { window: "active" | "cooling"; ageDays: number }) {
  const active = window === "active";
  return (
    <span
      className={`tnum inline-flex h-6 items-center gap-1 rounded-[6px] border px-2 text-[11px] font-bold uppercase tracking-[0.05em] ${
        active ? "border-go/30 text-go" : "border-watch-ring/40 text-watch"
      }`}
      title={active ? "Active: within 30 days — can qualify for Reach out" : "Cooling: 31–60 days — watch only"}
    >
      {active ? "Active" : "Cooling"} · {ageDays === 0 ? "today" : `${ageDays}d`}
    </span>
  );
}

/** Circular monogram "portrait" with a docked white satellite arrow (no photos are fetched). */
export function Monogram({ name, href, size = 52 }: { name: string; href?: string | null; size?: number }) {
  const initials = name
    .replace(/\([^)]*\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !/^[A-Z]\.$/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center rounded-full bg-ghost text-[17px] font-medium tracking-[-0.02em] text-charcoal">
        {initials}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${name}'s profile`}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_10px_rgb(0_0_0/0.10)] transition-transform duration-150 ease-out after:absolute after:-inset-2 after:content-[''] hover:scale-110 active:scale-95"
        >
          <ArrowUpRight />
        </a>
      )}
    </div>
  );
}

export function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ArrowUpRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden>
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" className={className} aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
