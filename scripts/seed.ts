/**
 * Seed the 50 verified investors from data/vc_seed.json.
 * INSERT-ONLY: upsert on (name, firm) with ignoreDuplicates, so re-seeding never
 * touches Vikram's manual columns (and the DB would reject such an UPDATE anyway).
 *
 *   npm run seed
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/supabase";

type SeedVc = {
  name: string;
  firm: string;
  role: string;
  thesis: string;
  focus_tags: string[];
  location: string;
  firm_website: string;
  blog_rss: string | null;
  linkedin_url: string | null;
};

const seed = JSON.parse(readFileSync(join(process.cwd(), "data", "vc_seed.json"), "utf8")) as SeedVc[];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// Clearly-labelled demo values for the manual columns (Vikram edits these in Supabase).
const WAITING_DAYS = [3, 5, 9, 12, 16, 19, 23, 27, 34, 41];
const NOTES = [
  "Warm intro possible via a MESA mentor.",
  "Met briefly at a SaaSBoomi meetup; asked to send deck when MRR > ₹10L.",
  "Portfolio has a freight-tech company — check for conflicts before pitching.",
  "Prefers short cold emails with one metric up top.",
  "Friend of an angel on our cap table.",
  "Writes a lot on India B2B GTM — reference their posts.",
  "Likely too early for them; keep warm.",
  "Invests globally — lead with US/SEA expansion story.",
];

const rows = seed.map((v, i) => {
  const waiting = i % 4 === 1 || i % 7 === 3; // ~35% waiting_for_response, rest yet_to_reach_out
  const lastContact = waiting ? daysAgo(WAITING_DAYS[i % WAITING_DAYS.length]) : null;
  return {
    name: v.name,
    firm: v.firm,
    role: v.role,
    thesis: v.thesis,
    focus_tags: v.focus_tags,
    location: v.location,
    firm_website: v.firm_website,
    blog_rss: v.blog_rss,
    linkedin_url: v.linkedin_url,
    contact_status: waiting ? "waiting_for_response" : "yet_to_reach_out",
    last_contact_date: lastContact,
    contact_history: waiting ? `[demo] ${lastContact}: cold email with 1-pager; no reply yet.` : null,
    personal_notes: `[demo] ${NOTES[i % NOTES.length]}`,
  };
});

async function main() {
  const { data, error } = await db()
    .from("vcs")
    .upsert(rows, { onConflict: "name,firm", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  const { count } = await db().from("vcs").select("id", { count: "exact", head: true });
  console.log(`Seed: ${data?.length ?? 0} inserted, ${rows.length - (data?.length ?? 0)} already present. vcs total = ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
