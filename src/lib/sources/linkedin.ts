import { env } from "../env";
import type { Candidate } from "../types";
import { fetchText, parseDate, type SourceVc } from "./util";

/**
 * OPTIONAL source — OFF unless APIFY_TOKEN is set and the VC has a linkedin_url.
 * Uses the Apify actor harvestapi/linkedin-profile-posts. Scraping LinkedIn may conflict
 * with LinkedIn's ToS; it is feature-flagged and labelled as optional in the README.
 */
export function linkedinEnabled(): boolean {
  return Boolean(env.apifyToken);
}

export async function linkedinPosts(vc: SourceVc, days: number): Promise<Candidate[]> {
  const token = env.apifyToken;
  if (!token || !vc.linkedin_url) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const body = JSON.stringify({ targetUrls: [vc.linkedin_url], postedLimitDate: since, maxPosts: 10 });
  const text = await fetchText(
    "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/run-sync-get-dataset-items",
    {
      method: "POST",
      body,
      timeoutMs: 120_000,
      retries: 0,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    },
  );
  const items = JSON.parse(text) as Array<Record<string, unknown>>;
  const out: Candidate[] = [];
  for (const p of items) {
    const url = (p.linkedinUrl ?? p.url ?? p.postUrl) as string | undefined;
    const posted = p.postedAt as { date?: string; timestamp?: number } | string | undefined;
    const publishedAt = parseDate(typeof posted === "object" ? (posted?.date ?? posted?.timestamp) : posted);
    if (!url || !publishedAt) continue;
    const content = String(p.content ?? p.text ?? "").replace(/\s+/g, " ").trim();
    out.push({
      url,
      title: content.slice(0, 120) || "LinkedIn post",
      snippet: content.slice(0, 500),
      source: "linkedin",
      publishedAt,
      origin: "linkedin",
      publisher: "linkedin.com",
    });
  }
  return out;
}
