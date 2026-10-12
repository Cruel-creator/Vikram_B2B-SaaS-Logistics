/**
 * Fetch live evidence for one investor and classify it with Gemini Flash (no DB writes).
 *
 *   npx tsx scripts/smoke-classify.ts "Sajith Pai"
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "node:fs";
import { classifyCandidates, lastModelUsed } from "../src/lib/gemini";
import { googleNewsPerson } from "../src/lib/sources/googleNews";
import { blogRss } from "../src/lib/sources/rss";

const seed = JSON.parse(readFileSync("data/vc_seed.json", "utf8"));
const name = process.argv[2] ?? "Sajith Pai";

async function main() {
  const vc = { id: "smoke", ...seed.find((v: { name: string }) => v.name === name) };
  const cands = [...(await googleNewsPerson(vc, 60)), ...(await blogRss(vc, 60))].slice(0, 8);
  console.log(`${vc.name}: ${cands.length} candidates`);
  const t = Date.now();
  const labels = await classifyCandidates(vc, cands);
  console.log(`model=${lastModelUsed} in ${Date.now() - t}ms`);
  cands.forEach((c, i) => {
    const l = labels[i];
    console.log(
      `${l.is_about_vc ? "✓" : "✗"} ${l.signal_type.padEnd(12)} rel=${l.relevance.toFixed(2)}  ${c.publishedAt.toISOString().slice(0, 10)}  ${c.title.slice(0, 70)}\n     ${l.summary}`,
    );
  });
}

main().catch((e) => {
  console.error("FAILED:", e?.status ?? "", e?.message ?? e);
  process.exit(1);
});
