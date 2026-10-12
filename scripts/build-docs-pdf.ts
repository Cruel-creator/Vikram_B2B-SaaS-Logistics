/**
 * Builder-facing documentation PDF (not shown in the app):
 *   p1 Components Map · p2 How a signal is scored (rubric + live worked example) · p3 Components & safeguards
 *
 *   npm run docs:pdf   →   docs/pipeline-intel-method.pdf
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { loadRelevantSignals } from "../src/lib/pipeline";
import { recency, scoreVc, TYPE_WEIGHT } from "../src/lib/scoring";
import { db } from "../src/lib/supabase";
import type { Vc } from "../src/lib/types";

const W = 842;
const H = 595;
const INK = rgb(0.078, 0.078, 0.075);
const SLATE = rgb(0.41, 0.41, 0.41);
const LINE = rgb(0.86, 0.85, 0.83);
const CREAM = rgb(0.988, 0.984, 0.98);
const GO = rgb(0.12, 0.48, 0.32);
const WATCH = rgb(0.6, 0.36, 0);
const SIGNAL = rgb(0.95, 0.45, 0.22);

const safe = (t: string) => t.replace(/→/g, "->").replace(/[−]/g, "-").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/×/g, "x").replace(/·/g, "·").replace(/[^\x20-\x7E -ÿ–—‘’“”]/g, "");

let reg: PDFFont;
let bold: PDFFont;

function text(p: PDFPage, t: string, x: number, y: number, size = 10, f?: PDFFont, color = INK) {
  p.drawText(safe(t), { x, y, size, font: f ?? reg, color });
}
function header(p: PDFPage, eyebrow: string, title: string, n: number) {
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  p.drawCircle({ x: 44, y: H - 40, size: 3, color: SIGNAL });
  text(p, eyebrow.toUpperCase(), 52, H - 43, 8.5, bold, SLATE);
  text(p, title, 40, H - 72, 22, bold);
  text(p, `Pipeline Intel · builder documentation · ${n}/3`, W - 230, 22, 8, reg, SLATE);
}
function table(p: PDFPage, x: number, y: number, cols: number[], rows: string[][], head = true) {
  let yy = y;
  rows.forEach((r, i) => {
    let xx = x;
    r.forEach((c, j) => {
      text(p, c, xx, yy, 9.5, head && i === 0 ? bold : reg, head && i === 0 ? SLATE : INK);
      xx += cols[j];
    });
    yy -= 15;
    if (i === 0 && head) p.drawLine({ start: { x, y: yy + 10 }, end: { x: x + cols.reduce((a, b) => a + b, 0), y: yy + 10 }, thickness: 0.6, color: LINE });
  });
  return yy;
}
function para(p: PDFPage, t: string, x: number, y: number, width: number, size = 9.5, color = INK): number {
  const words = safe(t).split(/\s+/);
  let line = "";
  let yy = y;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (reg.widthOfTextAtSize(next, size) > width) {
      text(p, line, x, yy, size, reg, color);
      yy -= size * 1.45;
      line = w;
    } else line = next;
  }
  if (line) text(p, line, x, yy, size, reg, color);
  return yy - size * 1.45;
}

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Pipeline Intel — Components Map & scoring rubric");
  reg = await pdf.embedFont(StandardFonts.Helvetica);
  bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ── p1 Components Map ──
  const p1 = pdf.addPage([W, H]);
  header(p1, "Architecture", "Components Map", 1);
  const png = await sharp(readFileSync("public/components-map.svg"), { density: 220 }).png().toBuffer();
  const img = await pdf.embedPng(png);
  const s = Math.min((W - 80) / img.width, (H - 130) / img.height);
  p1.drawImage(img, { x: (W - img.width * s) / 2, y: 40, width: img.width * s, height: img.height * s });

  // ── p2 Scoring rubric ──
  const p2 = pdf.addPage([W, H]);
  header(p2, "Scoring", "How a signal is scored", 2);
  let y = H - 104;
  text(p2, "1 · Eligibility", 40, y, 11, bold);
  y = para(p2, "A candidate becomes a signal only if the source gives a real URL and a parseable published date (never inferred by AI), and Gemini Flash confirms is_about_vc = true: the item is about this person at this firm, their own blog or post, or a deal/announcement by their firm. Namesakes are rejected. Signals older than 60 days are kept as history but never scored.", 40, y - 16, 360);

  text(p2, "2 · Type weight", 40, y - 6, 11, bold);
  y = table(p2, 40, y - 24, [150, 60], [["Signal type", "Weight"], ...Object.entries(TYPE_WEIGHT).map(([k, v]) => [k.replace("_", " "), v.toFixed(1)])]);

  text(p2, "3 · Relevance (Gemini rubric, 0-1)", 40, y - 8, 11, bold);
  table(
    p2,
    40,
    y - 26,
    [70, 300],
    [
      ["Band", "Topic"],
      ["0.9-1.0", "Logistics, freight, supply chain, fleet; India B2B SaaS seed"],
      ["0.7-0.8", "B2B SaaS, enterprise, AI-for-business; GTM/fundraising advice"],
      ["0.4-0.6", "Other tech deals, ecosystem/policy commentary, fund raises"],
      ["0.1-0.3", "Consumer/D2C, personal, political, unrelated"],
    ],
  );

  // right column
  const X = 440;
  let r = H - 104;
  text(p2, "4 · Recency by age (days)", X, r, 11, bold);
  r = table(p2, X, r - 18, [70, 70, 70], [["Age", "Recency", "Window"], ...[0, 10, 20, 30, 31, 45, 60, 61].map((a) => [String(a), recency(a).toFixed(2), a <= 30 ? "Active" : a <= 60 ? "Cooling" : "History"])]);
  text(p2, "5 · Formula", X, r - 6, 11, bold);
  r = para(p2, "signal_value = relevance x type_weight x recency(age). base = max(signal_value) + min(0.15, 0.05 x (active_count - 1)). Contact status: passed -> 0; waiting & last contact < 7 days -> cap 0.40; waiting & >= 14 days & an active signal -> +0.10. follow_up_score = round(100 x clamp(base, 0, 1)).", X, r - 22, 360);
  text(p2, "6 · Buckets", X, r - 4, 11, bold);
  r = table(p2, X, r - 22, [120, 240], [["Bucket", "Rule"], ["Reach out this week", "score >= 60 AND an active (<= 30d) signal"], ["Warm - watch", "score 25-59, or only cooling signals"], ["Quiet - deprioritize", "otherwise"]]);

  // Live worked example: the current #1 investor.
  const { data: vcs } = await db().from("vcs").select("*").order("follow_up_score", { ascending: false }).limit(1);
  const top = (vcs ?? [])[0] as Vc | undefined;
  if (top) {
    const sig = (await loadRelevantSignals([top.id])).get(top.id) ?? [];
    const res = scoreVc({ status: top.contact_status, lastContactDate: top.last_contact_date, signals: sig });
    text(p2, `7 · Worked example (live): ${top.name}, ${top.firm}`, X, r - 6, 11, bold, GO);
    let yy = r - 22;
    for (const line of [...res.explanation, `score = ${res.score} -> ${res.bucket.replace("_", " ")}`]) yy = para(p2, line, X, yy, 360, 9.5, line.startsWith("score") ? GO : INK);
  }

  // ── p3 Components & safeguards ──
  const p3 = pdf.addPage([W, H]);
  header(p3, "Reference", "Components & safeguards", 3);
  let z = table(
    p3,
    40,
    H - 110,
    [150, 330, 280],
    [
      ["Component", "Responsibility", "Code"],
      ["Vercel Cron", "ingest daily 06:00 IST · score Mon & Thu 07:00 IST", "vercel.json"],
      ["Ingest route", "5 VCs per invocation, self-chaining cursor, 300 s max", "api/cron/ingest, lib/runs.ts, lib/chain.ts"],
      ["Sources", "Google News, GDELT, blog RSS, Firecrawl, LinkedIn (optional)", "lib/sources/*"],
      ["Gemini Flash", "classify evidence; next move; outreach drafts (linted)", "lib/gemini.ts, lib/outreach/drafts.ts"],
      ["Scoring", "deterministic score, bucket, story de-duplication", "lib/scoring.ts (unit-tested)"],
      ["Score route", "writes 4 signal columns via update_vc_signals()", "api/cron/score, lib/pipeline.ts"],
      ["Outreach", "firm-site contacts, email mockup, Open in Gmail, deck per firm, LinkedIn note", "lib/outreach/*, api/outreach/*, api/deck/*"],
      ["Notes", "Vikram edits notes/status in-app via update_vc_manual()", "api/notes (admin token)"],
      ["Supabase", "vcs, signals, runs, contacts, firm_brands, outreach_*; RLS on", "supabase/schema.sql"],
    ],
  );
  text(p3, "Safeguards", 40, z - 10, 11, bold);
  const guards = [
    "Column GRANTs: the server key can UPDATE only last_signal_date, signal_summary, follow_up_score, recommended_action.",
    "Manual edits use one SECURITY DEFINER function, update_vc_manual(), called only by /api/notes (enforced by tests/guardrails.test.ts).",
    "Fingerprint: md5 of all manual columns before and after every run, stored in runs.protected_check and shown as 'Manual columns unchanged'.",
    "No hallucinated signals: URL and date come from the source; unclassified items are never stored; same story from many outlets counts once.",
    "Outreach: emails are copied verbatim from the firm's site (no guessing); unknown founder numbers stay as highlighted [placeholders]; the app never sends mail, Vikram sends from Gmail.",
    "All AI is Gemini Flash; no Claude/OpenAI SDKs (enforced by tests).",
  ];
  z -= 28;
  for (const g of guards) {
    p3.drawCircle({ x: 44, y: z + 3, size: 1.8, color: INK });
    z = para(p3, g, 52, z, 740);
  }
  text(p3, "30/60-day windows: only 0-30 day signals can trigger Reach out (the brief's rule); 31-60 day signals show as Cooling; older is history.", 40, z - 8, 9.5, reg, WATCH);

  writeFileSync("docs/pipeline-intel-method.pdf", await pdf.save());
  console.log("✓ docs/pipeline-intel-method.pdf");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
