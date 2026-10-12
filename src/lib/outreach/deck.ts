import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { DECK, FOUNDER } from "./founder";

export interface DeckRecipient {
  name: string; // person the deck is prepared for
  title: string | null;
  firm: string;
  logoPngBase64: string | null;
  accent: string | null; // firm accent (hex) — used as a thin band only
  logoBg?: "light" | "dark" | null; // light-on-dark logos get an ink chip
}

const W = 960;
const H = 540;
const CREAM = rgb(0xf3 / 255, 0xf0 / 255, 0xee / 255);
const INK = rgb(0x14 / 255, 0x14 / 255, 0x13 / 255);
const SLATE = rgb(0x69 / 255, 0x69 / 255, 0x69 / 255);
const SIGNAL = rgb(0xf3 / 255, 0x73 / 255, 0x38 / 255);
const WHITE = rgb(1, 1, 1);

function hex(h: string | null, fallback: RGB): RGB {
  const m = h?.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Standard PDF fonts are WinAnsi: map the few characters they can't encode. */
function safe(t: string): string {
  return t
    .replace(/₹\s?/g, "Rs ")
    .replace(/[→]/g, "->")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function mark(page: PDFPage, x: number, y: number) {
  page.drawCircle({ x, y, size: 9, borderColor: INK, borderWidth: 1.4 });
  page.drawCircle({ x, y, size: 3, color: INK });
  page.drawCircle({ x: x + 7.5, y: y + 7.5, size: 2.4, color: SIGNAL });
}

export async function buildDeck(r: DeckRecipient): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(safe(`${FOUNDER.company} — seed deck, prepared for ${r.name} (${r.firm})`));
  pdf.setAuthor(FOUNDER.firstName);
  pdf.setSubject("Illustrative draft deck");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hex(r.accent, INK);

  // ── Cover: Vikram's brand, addressed to the person, firm logo + accent band ──
  const cover = pdf.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  cover.drawRectangle({ x: 0, y: 0, width: 14, height: H, color: accent });

  // Firm logo in a white chip (top-left); falls back to the firm name.
  const chipX = 64;
  const chipY = 418;
  const chipH = 72;
  let chipW = 220;
  let logoDrawn = false;
  if (r.logoPngBase64) {
    try {
      const img = await pdf.embedPng(Buffer.from(r.logoPngBase64, "base64"));
      const s = Math.min(180 / img.width, 44 / img.height);
      const w = img.width * s;
      const h = img.height * s;
      chipW = w + 40;
      const dark = r.logoBg === "dark";
      cover.drawRectangle({
        x: chipX,
        y: chipY,
        width: chipW,
        height: chipH,
        color: dark ? INK : WHITE,
        borderColor: dark ? INK : rgb(0.9, 0.89, 0.88),
        borderWidth: 1,
      });
      cover.drawImage(img, { x: chipX + 20, y: chipY + (chipH - h) / 2, width: w, height: h });
      logoDrawn = true;
    } catch {
      /* not a valid PNG → text fallback */
    }
  }
  if (!logoDrawn) {
    const label = safe(r.firm);
    chipW = bold.widthOfTextAtSize(label, 18) + 40;
    cover.drawRectangle({ x: chipX, y: chipY, width: chipW, height: chipH, color: WHITE });
    cover.drawText(label, { x: chipX + 20, y: chipY + 28, size: 18, font: bold, color: INK });
  }

  cover.drawText("PREPARED FOR", { x: 64, y: 350, size: 10, font: bold, color: SLATE });
  cover.drawCircle({ x: 58, y: 353.5, size: 2.6, color: accent });
  cover.drawText(safe(r.name), { x: 64, y: 312, size: 32, font: bold, color: INK });
  cover.drawText(safe([r.title, r.firm].filter(Boolean).join(" · ")).slice(0, 90), { x: 64, y: 288, size: 13, font: reg, color: SLATE });

  cover.drawText(safe(FOUNDER.company), { x: 64, y: 160, size: 58, font: bold, color: INK });
  wrap(`${FOUNDER.oneLiner[0].toUpperCase()}${FOUNDER.oneLiner.slice(1)}.`, reg, 17, 620).forEach((l, i) =>
    cover.drawText(l, { x: 64, y: 124 - i * 22, size: 17, font: reg, color: INK }),
  );
  cover.drawText(safe(`Seed round · ${DECK.date()}`), { x: 64, y: 58, size: 12, font: bold, color: SLATE });
  mark(cover, W - 64, 62);
  cover.drawText("Confidential · Illustrative draft deck", { x: W - 270, y: 24, size: 9, font: reg, color: SLATE });

  // ── Content slides (illustrative) ──
  DECK.slides.forEach((s, i) => {
    const p = pdf.addPage([W, H]);
    p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
    p.drawRectangle({ x: 64, y: 462, width: 8, height: 8, color: SIGNAL });
    p.drawText(safe(`${FOUNDER.company.toUpperCase()} · ILLUSTRATIVE`), { x: 80, y: 462, size: 9, font: bold, color: SLATE });
    p.drawText(safe(s.title), { x: 64, y: 396, size: 38, font: bold, color: INK });
    let y = 320;
    for (const line of s.lines) {
      const ls = wrap(line, reg, 20, 760);
      p.drawCircle({ x: 70, y: y + 6, size: 3, color: INK });
      ls.forEach((l, j) => p.drawText(l, { x: 86, y: y - j * 26, size: 20, font: reg, color: INK }));
      y -= ls.length * 26 + 22;
    }
    p.drawText(String(i + 2).padStart(2, "0"), { x: W - 88, y: 40, size: 11, font: bold, color: SLATE });
    mark(p, 74, 46);
  });

  return pdf.save();
}

export function deckFileName(firm: string): string {
  return `${FOUNDER.company}-seed-deck-for-${firm.replace(/\([^)]*\)/g, "").trim().replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
}
