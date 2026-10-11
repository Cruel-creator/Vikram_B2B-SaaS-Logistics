import Firecrawl from "@mendable/firecrawl-js";
import { env } from "../env";
import { db } from "../supabase";
import type { Candidate } from "../types";
import { firmShort, leadingDate, nameVariants, parseDate, type SourceVc } from "./util";

const CACHE_HOURS = 72;
/** Free tier: ~2 credits per /search call (10 results, no scraping). */
export const CREDITS_PER_SEARCH = 2;

type CachedResult = { url: string; title: string; snippet: string; date: string | null; kind: "news" | "web" };

const mdy = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;

/**
 * Firecrawl /search — paid-credit fallback, only called for VCs where the free sources
 * found no active signal. Results are cached by query for 72h in `search_cache`.
 */
export async function firecrawlPerson(
  vc: SourceVc,
  days: number,
): Promise<{ candidates: Candidate[]; creditsUsed: number; cached: boolean }> {
  const key = env.firecrawlKey;
  if (!key) return { candidates: [], creditsUsed: 0, cached: false };

  const query = `"${nameVariants(vc.name)[0]}" ${firmShort(vc.firm)}`;
  const now = new Date();

  const { data: hit } = await db().from("search_cache").select("fetched_at, results").eq("query", query).maybeSingle();
  let results: CachedResult[];
  let cached = false;
  let creditsUsed = 0;

  if (hit && now.getTime() - Date.parse(hit.fetched_at) < CACHE_HOURS * 3_600_000) {
    results = hit.results as CachedResult[];
    cached = true;
  } else {
    const fc = new Firecrawl({ apiKey: key });
    const since = new Date(now.getTime() - days * 86_400_000);
    const res = await fc.search(query, {
      limit: 10,
      sources: ["news", "web"],
      tbs: `cdr:1,cd_min:${mdy(since)},cd_max:${mdy(now)}`,
      timeout: 30_000,
    });
    creditsUsed = CREDITS_PER_SEARCH;
    results = [];
    for (const n of (res.news ?? []) as Array<Record<string, unknown>>) {
      const url = (n.url as string) ?? (n.metadata as Record<string, string> | undefined)?.sourceURL;
      if (!url) continue;
      results.push({
        url,
        title: String(n.title ?? ""),
        snippet: String(n.snippet ?? n.description ?? ""),
        date: (n.date as string) ?? null,
        kind: "news",
      });
    }
    for (const w of (res.web ?? []) as Array<Record<string, unknown>>) {
      const url = (w.url as string) ?? (w.metadata as Record<string, string> | undefined)?.sourceURL;
      if (!url) continue;
      const meta = w.metadata as Record<string, string> | undefined;
      results.push({
        url,
        title: String(w.title ?? meta?.title ?? ""),
        snippet: String(w.description ?? meta?.description ?? ""),
        date: meta?.publishedTime ?? meta?.["article:published_time"] ?? null,
        kind: "web",
      });
    }
    await db()
      .from("search_cache")
      .upsert({ query, fetched_at: now.toISOString(), results }, { onConflict: "query" });
  }

  const candidates: Candidate[] = [];
  for (const r of results) {
    // A real published date is mandatory — from the result itself or the snippet's date prefix.
    const publishedAt = parseDate(r.date, now) ?? leadingDate(r.snippet, now);
    if (!publishedAt) continue;
    if (now.getTime() - publishedAt.getTime() > days * 86_400_000) continue;
    candidates.push({
      url: r.url,
      title: r.title,
      snippet: r.snippet.slice(0, 400),
      source: "firecrawl",
      publishedAt,
      origin: "web_search",
      publisher: (() => {
        try {
          return new URL(r.url).host.replace(/^www\./, "");
        } catch {
          return undefined;
        }
      })(),
    });
  }
  return { candidates, creditsUsed, cached };
}
