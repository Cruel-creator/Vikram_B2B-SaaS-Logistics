export const SIGNAL_TYPES = [
  "investment",
  "blog_post",
  "interview",
  "event",
  "social_post",
  "news_mention",
  "other",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const CONTACT_STATUSES = [
  "yet_to_reach_out",
  "waiting_for_response",
  "in_conversation",
  "passed",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export type SourceName = "google_news" | "gdelt" | "rss" | "firecrawl" | "linkedin" | "manual";

export type Bucket = "reach_out" | "warm" | "quiet";

export interface Vc {
  id: string;
  name: string;
  firm: string;
  role: string | null;
  thesis: string | null;
  focus_tags: string[];
  location: string | null;
  firm_website: string | null;
  blog_rss: string | null;
  linkedin_url: string | null;
  // manual (read-only for the pipeline)
  contact_status: ContactStatus;
  last_contact_date: string | null;
  contact_history: string | null;
  personal_notes: string | null;
  // signal-derived (the only columns the pipeline writes)
  last_signal_date: string | null;
  signal_summary: string | null;
  follow_up_score: number | null;
  recommended_action: string | null;
}

export interface SignalRow {
  id: string;
  vc_id: string;
  url: string;
  title: string | null;
  snippet: string | null;
  source: SourceName;
  signal_type: SignalType | null;
  relevance: number | null;
  is_about_vc: boolean | null;
  summary: string | null;
  published_at: string;
  discovered_at: string;
}

/** A raw piece of evidence fetched from a live source, before classification. */
export interface Candidate {
  url: string;
  title: string;
  snippet: string;
  source: SourceName;
  publishedAt: Date;
  /** Hint for the classifier about how this candidate was found. */
  origin: "person_query" | "firm_query" | "own_blog" | "firm_blog" | "web_search" | "linkedin";
  publisher?: string;
}

export interface Classification {
  is_about_vc: boolean;
  signal_type: SignalType;
  relevance: number;
  summary: string;
}

export interface RunRow {
  id: string;
  kind: "ingest" | "score" | "full";
  trigger: "cron" | "manual";
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  vcs_processed: number | null;
  vcs_total: number | null;
  signals_new: number | null;
  firecrawl_credits: number | null;
  stage: string | null;
  errors: Array<{ at: string; vc?: string; source?: string; message: string }>;
  protected_check: { before_hash?: string; after_hash?: string; unchanged?: boolean } | null;
}
