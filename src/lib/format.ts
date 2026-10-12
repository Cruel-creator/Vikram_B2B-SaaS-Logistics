import type { Bucket, ContactStatus, SignalType } from "./types";

export const TZ = "Asia/Kolkata";

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { ...opts, timeZone: TZ });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

export function relTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "never";
  const diff = now.getTime() - Date.parse(iso);
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function duration(start: string, end: string | null): string {
  if (!end) return "—";
  const s = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export const STATUS_LABEL: Record<ContactStatus, string> = {
  yet_to_reach_out: "Not contacted",
  waiting_for_response: "Awaiting reply",
  in_conversation: "In conversation",
  passed: "Passed",
};

export const TYPE_LABEL: Record<SignalType, string> = {
  investment: "Investment",
  blog_post: "Wrote",
  interview: "Interview",
  event: "Event",
  social_post: "Post",
  news_mention: "Mention",
  other: "Other",
};

export const BUCKET_META: Record<Bucket, { title: string; kicker: string; color: string; dim: string; blurb: string }> = {
  reach_out: {
    title: "Reach out this week",
    kicker: "01",
    color: "var(--color-go)",
    dim: "var(--color-go-tint)",
    blurb: "Score ≥ 60 with an active signal from the last 30 days. Lead with the signal.",
  },
  warm: {
    title: "Warm — watch",
    kicker: "02",
    color: "var(--color-watch-ring)",
    dim: "var(--color-watch-tint)",
    blurb: "Mid-scoring, cooling (31–60 day) signals, or contacted too recently to nudge.",
  },
  quiet: {
    title: "Quiet — deprioritize",
    kicker: "03",
    color: "var(--color-rest)",
    dim: "var(--color-rest-tint)",
    blurb: "No observable, relevant signal in the last 60 days. Revisit next run.",
  },
};

/** Split Google News "Headline - Publisher" into parts; fall back to the URL host. */
export function splitTitle(title: string | null, url: string, source: string): { headline: string; publisher: string } {
  const t = (title ?? "").trim();
  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return source;
    }
  })();
  if (source === "google_news") {
    const i = t.lastIndexOf(" - ");
    if (i > 0) return { headline: t.slice(0, i), publisher: t.slice(i + 3) };
    return { headline: t, publisher: "Google News" };
  }
  return { headline: t || host, publisher: host };
}

export const SOURCE_LABEL: Record<string, string> = {
  google_news: "Google News",
  gdelt: "GDELT",
  rss: "Blog RSS",
  firecrawl: "Firecrawl",
  linkedin: "LinkedIn",
  manual: "Manual",
};
