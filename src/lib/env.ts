// Centralised, lazily-validated environment access. Server-only values are never
// read from client components (nothing here is prefixed NEXT_PUBLIC_ except the URL).

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function num(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get geminiKey() {
    // The key in the handoff notes was wrapped over two lines; strip any whitespace.
    return required("GEMINI_API_KEY").replace(/\s+/g, "");
  },
  get geminiModel() {
    return optional("GEMINI_MODEL") ?? "gemini-3.8-flash";
  },
  get firecrawlKey() {
    return optional("FIRECRAWL_API_KEY");
  },
  get apifyToken() {
    return optional("APIFY_TOKEN");
  },
  get cronSecret() {
    return optional("CRON_SECRET");
  },
  get adminToken() {
    return optional("ADMIN_TOKEN");
  },
  get lookbackDays() {
    return num("SIGNAL_LOOKBACK_DAYS", 60);
  },
  get activeDays() {
    return num("ACTIVE_WINDOW_DAYS", 30);
  },
};
