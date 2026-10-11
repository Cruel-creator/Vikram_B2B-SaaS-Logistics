import type { Bucket, ContactStatus, SignalType } from "@/lib/types";
import { BUCKET_META, STATUS_LABEL, TYPE_LABEL } from "@/lib/format";

export function ScoreRing({ score, bucket, size = 64 }: { score: number | null; bucket: Bucket; size?: number }) {
  const stroke = size >= 60 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const color = BUCKET_META[bucket].color;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Follow-up score ${score ?? "pending"}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          style={{ filter: bucket === "reach_out" ? "drop-shadow(0 0 6px rgb(212 255 63 / 0.45))" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[17px] font-medium leading-none tabular-nums" style={{ color: size >= 60 ? color : undefined }}>
          {score ?? "–"}
        </span>
        {size >= 60 && <span className="mt-0.5 font-mono text-[8.5px] tracking-[0.15em] text-faint">SCORE</span>}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<ContactStatus, string> = {
  yet_to_reach_out: "text-fg border-line-strong",
  waiting_for_response: "text-info border-info/30 bg-info/5",
  in_conversation: "text-ok border-ok/30 bg-ok/5",
  passed: "text-faint border-line line-through",
};

export function StatusPill({ status, lastContactDate }: { status: ContactStatus; lastContactDate?: string | null }) {
  const days = lastContactDate ? Math.floor((Date.now() - Date.parse(lastContactDate)) / 86_400_000) : null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] ${STATUS_TONE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status]}
      {status === "waiting_for_response" && days !== null && <span className="font-mono text-[10.5px] opacity-70">· {days}d</span>}
    </span>
  );
}

const TYPE_TONE: Record<SignalType, string> = {
  investment: "bg-reach text-ink",
  blog_post: "bg-info/15 text-info",
  interview: "bg-[#c49bff]/15 text-[#c49bff]",
  event: "bg-warm/15 text-warm",
  social_post: "bg-[#ff8fc7]/15 text-[#ff8fc7]",
  news_mention: "bg-white/8 text-muted",
  other: "bg-white/5 text-faint",
};

export function TypeBadge({ type }: { type: SignalType }) {
  return (
    <span className={`inline-flex h-[19px] items-center rounded-[5px] px-1.5 font-mono text-[10px] font-medium uppercase tracking-wider ${TYPE_TONE[type]}`}>
      {TYPE_LABEL[type]}
    </span>
  );
}

export function WindowTag({ window, ageDays }: { window: "active" | "cooling"; ageDays: number }) {
  const active = window === "active";
  return (
    <span
      className={`inline-flex h-[19px] items-center gap-1 rounded-[5px] border px-1.5 font-mono text-[10px] tracking-wide ${
        active ? "border-reach/30 text-reach" : "border-warm/30 text-warm"
      }`}
      title={active ? "Active: within 30 days — eligible for Reach out" : "Cooling: 31–60 days — watch only"}
    >
      {active ? "ACTIVE" : "COOLING"} · {ageDays === 0 ? "today" : `${ageDays}d`}
    </span>
  );
}

export function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function ArrowUpRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" className={className} aria-hidden>
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
