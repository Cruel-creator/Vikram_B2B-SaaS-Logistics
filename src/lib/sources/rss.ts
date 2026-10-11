import { XMLParser } from "fast-xml-parser";
import type { Candidate } from "../types";
import { fetchText, parseDate, stripHtml, type SourceVc } from "./util";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as object)) return String((v as { "#text": unknown })["#text"] ?? "");
  return "";
};

function atomLink(link: unknown): string {
  const links = Array.isArray(link) ? link : [link];
  const alt = links.find((l) => l && typeof l === "object" && ((l as Record<string, string>)["@_rel"] ?? "alternate") === "alternate");
  const chosen = alt ?? links[0];
  if (typeof chosen === "string") return chosen;
  return (chosen as Record<string, string> | undefined)?.["@_href"] ?? "";
}

/** Personal blogs/Substacks are "own_blog"; firm-wide feeds (multiple authors) are "firm_blog". */
function feedOrigin(feedUrl: string, vcName: string): Candidate["origin"] {
  const host = new URL(feedUrl).host + new URL(feedUrl).pathname;
  const last = vcName.split(" ").pop()!.toLowerCase();
  const first = vcName.split(" ")[0].toLowerCase();
  return host.toLowerCase().includes(last) || host.toLowerCase().includes(first) ? "own_blog" : "firm_blog";
}

export async function blogRss(vc: SourceVc, days: number): Promise<Candidate[]> {
  if (!vc.blog_rss) return [];
  const xml = await fetchText(vc.blog_rss, {
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
  });
  const doc = parser.parse(xml);
  const origin = feedOrigin(vc.blog_rss, vc.name);
  const now = new Date();
  const out: Candidate[] = [];

  const rssItems = doc?.rss?.channel?.item;
  const atomEntries = doc?.feed?.entry;
  const items: Record<string, unknown>[] = rssItems
    ? Array.isArray(rssItems)
      ? rssItems
      : [rssItems]
    : atomEntries
      ? Array.isArray(atomEntries)
        ? atomEntries
        : [atomEntries]
      : [];

  for (const it of items) {
    const url = rssItems ? text(it.link) || text(it.guid) : atomLink(it.link);
    const publishedAt = parseDate(text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"]));
    if (!url || !publishedAt) continue;
    if (now.getTime() - publishedAt.getTime() > days * 86_400_000) continue;
    const author = text(it["dc:creator"]) || text((it.author as Record<string, unknown> | undefined)?.name) || text(it.author);
    const body = stripHtml(text(it.description) || text(it.summary) || text(it["content:encoded"]) || text(it.content));
    out.push({
      url: url.trim(),
      title: stripHtml(text(it.title)),
      snippet: (author ? `By ${author}. ` : "") + body.slice(0, 500),
      source: "rss",
      publishedAt,
      origin,
      publisher: new URL(vc.blog_rss).host,
    });
  }
  return out;
}
