/**
 * Find each investor's best published contact address + their firm's logo/accent colour,
 * from the firm's OWN website (deterministic extraction — nothing guessed or AI-generated).
 * Writes only `contacts` and `firm_brands`; never touches `vcs`.
 *
 *   npx tsx scripts/find-contacts.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import sharp from "sharp";
import { db } from "../src/lib/supabase";
import {
  bestEmail,
  candidateLinks,
  classifyEmail,
  extractBrand,
  extractEmails,
  getHtml,
  rootDomain,
  type FoundEmail,
} from "../src/lib/outreach/site";
import { UA } from "../src/lib/sources/util";
import type { Vc } from "../src/lib/types";

function hexToSL(hex: string): [number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return [s, l];
}
const usable = (hex: string | null) => {
  const sl = hex ? hexToSL(hex) : null;
  return Boolean(sl && sl[0] > 0.25 && sl[1] > 0.15 && sl[1] < 0.8);
};
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

async function logoToPng(url: string): Promise<{ png: string; accent: string | null } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const png = await sharp(buf, { density: 300 })
      .trim({ threshold: 10 })
      .resize({ height: 120, width: 420, fit: "inside" })
      .png()
      .toBuffer();
    // Dominant colour, ignoring transparent, near-white, near-black and grey pixels.
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const buckets = new Map<string, number>();
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 3] < 200) continue;
      const hex = toHex(data[i] & 0xf0, data[i + 1] & 0xf0, data[i + 2] & 0xf0);
      if (!usable(hex)) continue;
      buckets.set(hex, (buckets.get(hex) ?? 0) + 1);
    }
    // Reject blank/near-empty images (e.g. inline SVGs that render nothing) — text fallback is better.
    let opaque = 0;
    for (let i = 3; i < data.length; i += info.channels) if (data[i] > 128) opaque++;
    if (opaque / (info.width * info.height) < 0.03) return null;
    const top = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
    return { png: png.toString("base64"), accent: top && top[1] > 30 ? top[0] : null };
  } catch {
    return null;
  }
}

/** Logos drawn for dark backgrounds (mostly-light opaque pixels) need a dark chip. */
async function logoBackground(pngBase64: string): Promise<"light" | "dark"> {
  const { data, info } = await sharp(Buffer.from(pngBase64, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  // Mostly-white artwork with a transparent background disappears on a white chip.
  const transparentShare = 1 - n / (info.width * info.height);
  return n > 0 && sum / n > 0.82 && transparentShare > 0.2 ? "dark" : "light";
}

async function main() {
  // `--logos-only`: recompute chip backgrounds from stored logos without re-crawling.
  if (process.argv.includes("--logos-only")) {
    const { data: brands } = await db().from("firm_brands").select("firm, logo_png");
    for (const b of brands ?? []) {
      if (!b.logo_png) continue;
      const bg = await logoBackground(b.logo_png);
      await db().from("firm_brands").update({ logo_bg: bg }).eq("firm", b.firm);
      console.log(`${b.firm.padEnd(36)} ${bg}`);
    }
    return;
  }
  const { data, error } = await db().from("vcs").select("*").order("firm");
  if (error) throw error;
  const vcs = data as Vc[];
  const firms = new Map<string, Vc[]>();
  for (const v of vcs) firms.set(v.firm, [...(firms.get(v.firm) ?? []), v]);

  let withEmail = 0;
  for (const [firm, people] of firms) {
    const site = people[0].firm_website;
    if (!site) continue;
    const home = await getHtml(site);
    if (!home) {
      console.log(`✗ ${firm}: site unreachable`);
      continue;
    }

    // Emails from the homepage + up to 4 contact/pitch/team pages on the same domain.
    const pages = [{ url: site, html: home.html }];
    for (const link of candidateLinks(home.html, site)) {
      const p = await getHtml(link);
      if (p) pages.push({ url: link, html: p.html });
    }
    const domain = rootDomain(site);

    // Brand: logo + accent (theme-color if saturated, else the logo's dominant colour).
    const brand = extractBrand(home.html, site, firm);
    let logoPng: string | null = null;
    let accent: string | null = usable(brand.themeColor) ? brand.themeColor : null;
    if (brand.logoUrl) {
      const l = await logoToPng(brand.logoUrl);
      if (l) {
        logoPng = l.png;
        accent = accent ?? l.accent;
      }
    }
    await db().from("firm_brands").upsert(
      {
        firm,
        domain,
        logo_url: brand.logoUrl,
        logo_png: logoPng,
        logo_bg: logoPng ? await logoBackground(logoPng) : null,
        logo_page: brand.page,
        accent,
        source: home.via,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "firm" },
    );

    for (const vc of people) {
      const found: FoundEmail[] = [];
      for (const p of pages) {
        for (const e of extractEmails(p.html)) {
          const kind = classifyEmail(e, vc.name, domain);
          if (kind && !found.some((f) => f.email === e)) found.push({ email: e, kind, page: p.url });
        }
      }
      const best = bestEmail(found);
      if (best) withEmail++;
      await db().from("contacts").upsert(
        {
          vc_id: vc.id,
          firm,
          name: vc.name,
          title: vc.role,
          email: best?.email ?? null,
          email_status: best?.kind ?? "not_found",
          linkedin_url: vc.linkedin_url,
          city: vc.location,
          source: "website",
          source_ref: best?.page ?? site,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "vc_id,source" },
      );
      console.log(`${best ? "✓" : "·"} ${vc.name.padEnd(28)} ${best ? `${best.email} (${best.kind})` : "no published email"}`);
    }
    console.log(`   ${firm}: logo=${logoPng ? "png" : "none"} accent=${accent ?? "none"} via ${home.via} (${pages.length} pages)`);
  }
  console.log(`\n${withEmail}/${vcs.length} investors have a published address.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
