import { XMLParser } from "fast-xml-parser";
import type { Candidate } from "../types";
import { fetchText, firmAliases, nameVariants, parseDate, quote, stripHtml, type SourceVc } from "./util";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function rssUrl(q: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

type GnItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: string | { "#text"?: string; "@_url"?: string };
};

async function search(q: string, origin: Candidate["origin"]): Promise<Candidate[]> {
  const xml = await fetchText(rssUrl(q), { headers: { Accept: "application/rss+xml, text/xml" } });
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item;
  const items: GnItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Candidate[] = [];
  for (const it of items) {
    const publishedAt = parseDate(it.pubDate);
    if (!it.link || !publishedAt) continue;
    const publisher = typeof it.source === "string" ? it.source : it.source?.["#text"];
    // Keep Google's "Headline - Publisher" form: the link is a news.google.com redirect,
    // so the suffix is the only place the publisher survives in the stored row.
    const title = String(it.title ?? "").trim();
    out.push({
      url: String(it.link),
      title,
      snippet: stripHtml(it.description).slice(0, 400),
      source: "google_news",
      publishedAt,
      origin,
      publisher,
    });
  }
  return out;
}

/** Person query: ("Name" OR "Nick Name") "Firm" when:60d */
export async function googleNewsPerson(vc: SourceVc, days: number): Promise<Candidate[]> {
  const names = nameVariants(vc.name).map(quote);
  const firms = firmAliases(vc.firm).map(quote);
  const nameExpr = names.length > 1 ? `(${names.join(" OR ")})` : names[0];
  const firmExpr = firms.length > 1 ? `(${firms.join(" OR ")})` : firms[0];
  return search(`${nameExpr} ${firmExpr} when:${days}d`, "person_query");
}

/** Firm query for investments: "Firm" (invests OR "led by" OR raises) when:60d */
export async function googleNewsFirm(firm: string, days: number): Promise<Candidate[]> {
  const firms = firmAliases(firm).map(quote);
  const firmExpr = firms.length > 1 ? `(${firms.join(" OR ")})` : firms[0];
  return search(`${firmExpr} (invests OR "led by" OR raises) when:${days}d`, "firm_query");
}
