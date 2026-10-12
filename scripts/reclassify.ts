/**
 * Re-run Gemini classification over stored relevant signals (e.g. after a rubric change).
 * UPDATEs labels in place — signals are never deleted.
 *
 *   npx tsx scripts/reclassify.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { classifyCandidates, CLASSIFY_BATCH } from "../src/lib/gemini";
import { nameVariants } from "../src/lib/sources/util";
import { db } from "../src/lib/supabase";
import type { Candidate, Vc } from "../src/lib/types";

async function main() {
  const { data: vcs } = await db().from("vcs").select("*");
  const { data: rows, error } = await db()
    .from("signals")
    .select("id, vc_id, url, title, snippet, source, published_at")
    .eq("is_about_vc", true);
  if (error) throw error;

  const byVc = new Map<string, typeof rows>();
  for (const r of rows ?? []) byVc.set(r.vc_id, [...(byVc.get(r.vc_id) ?? []), r]);

  let updated = 0;
  for (const [vcId, list] of byVc) {
    const vc = (vcs as Vc[]).find((v) => v.id === vcId)!;
    const surname = nameVariants(vc.name)[0].split(" ").pop()!.toLowerCase();
    for (let i = 0; i < list!.length; i += CLASSIFY_BATCH) {
      const batch = list!.slice(i, i + CLASSIFY_BATCH);
      const cands: Candidate[] = batch.map((r) => ({
        url: r.url,
        title: r.title ?? "",
        snippet: r.snippet ?? "",
        source: r.source,
        publishedAt: new Date(r.published_at),
        origin:
          r.source === "rss"
            ? "own_blog"
            : r.source === "firecrawl"
              ? "web_search"
              : `${r.title} ${r.snippet}`.toLowerCase().includes(surname)
                ? "person_query"
                : "firm_query",
      }));
      const labels = await classifyCandidates(vc, cands);
      for (let j = 0; j < batch.length; j++) {
        const l = labels[j];
        await db()
          .from("signals")
          .update({
            is_about_vc: l.is_about_vc,
            signal_type: l.signal_type,
            relevance: Math.round(l.relevance * 100) / 100,
            summary: l.summary || null,
            classified_at: new Date().toISOString(),
          })
          .eq("id", batch[j].id);
        updated++;
      }
    }
    console.log(`${vc.name}: ${list!.length} re-labelled`);
  }
  console.log(`done: ${updated} signals updated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
