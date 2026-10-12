/**
 * Print fresh outreach drafts for a few investors (writes the outreach_drafts cache).
 *
 *   npx tsx scripts/preview-drafts.ts "Sajith Pai" "Dayna Grayson"
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { getDraft, loadOutreach } from "../src/lib/outreach/context";
import { lintEmail, lintLinkedin } from "../src/lib/outreach/drafts";
import { db } from "../src/lib/supabase";

async function main() {
  const names = process.argv.slice(2);
  for (const name of names) {
    const { data } = await db().from("vcs").select("id").eq("name", name).maybeSingle();
    if (!data) continue;
    const ctx = await loadOutreach(data.id);
    if (!ctx) continue;
    const d = await getDraft(ctx, true);
    const first = name.split(" ")[0];
    console.log(`\n══ ${name} · ${ctx.vc.firm} · to: ${ctx.contact?.email ?? "(no published email)"} · model: ${d.model}`);
    console.log(`Subject: ${d.subject}\n\n${d.body}`);
    console.log(`\n── LinkedIn (${d.linkedin.length} chars)\n${d.linkedin}`);
    const issues = [...lintEmail(d.subject, d.body, first), ...lintLinkedin(d.linkedin)];
    console.log(`\nlint: ${issues.length ? issues.join("; ") : "clean"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
