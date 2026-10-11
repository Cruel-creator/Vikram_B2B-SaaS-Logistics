/**
 * Smoke-test the keyless live sources against a few seeded investors (no DB, no AI).
 *
 *   npx tsx scripts/smoke-sources.ts
 */
import { readFileSync } from "node:fs";
import { gdeltPerson } from "../src/lib/sources/gdelt";
import { googleNewsFirm, googleNewsPerson } from "../src/lib/sources/googleNews";
import { blogRss } from "../src/lib/sources/rss";
import type { SourceVc } from "../src/lib/sources/util";

const seed = JSON.parse(readFileSync("data/vc_seed.json", "utf8")) as Array<Omit<SourceVc, "id">>;
const pick = ["Sajith Pai", "Rajan Anandan", "Hemant Mohapatra", "Santosh Sankar"];
const days = 60;

async function main() {
  for (const name of pick) {
    const vc = { id: "smoke", ...seed.find((v) => v.name === name)! };
    console.log(`\n=== ${vc.name} · ${vc.firm}`);
    for (const [label, fn] of [
      ["google_news", () => googleNewsPerson(vc, days)],
      ["google_news_firm", () => googleNewsFirm(vc.firm, days)],
      ["gdelt", () => gdeltPerson(vc, days)],
      ["rss", () => blogRss(vc, days)],
    ] as const) {
      try {
        const items = await fn();
        console.log(`  ${label.padEnd(17)} ${String(items.length).padStart(3)} items`);
        for (const c of items.slice(0, 2))
          console.log(`      ${c.publishedAt.toISOString().slice(0, 10)}  ${c.title.slice(0, 90)}`);
      } catch (e) {
        console.log(`  ${label.padEnd(17)} ERROR ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }
}

main();
