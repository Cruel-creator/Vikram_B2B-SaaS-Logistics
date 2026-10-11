import { createHash } from "node:crypto";
import type { Vc } from "../types";

export const UA =
  "Mozilla/5.0 (compatible; VCPipelineIntel/1.0; +https://github.com/Cruel-creator/Vikram_B2B-SaaS-Logistics)";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch with timeout + polite exponential backoff on 429/5xx. */
export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string>; method?: string; body?: string } = {},
): Promise<string> {
  const { timeoutMs = 15_000, retries = 2, headers = {}, method = "GET", body } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: { "User-Agent": UA, Accept: "*/*", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} from ${new URL(url).host}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      const retriable = !(e instanceof HttpError) || e.status === 429 || e.status >= 500;
      if (!retriable || attempt === retries) break;
      await sleep(1500 * 2 ** attempt + Math.random() * 500);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";

/**
 * Parse a published date from a source. Accepts RFC-822/ISO, GDELT compact
 * (20261005T123000Z), and relative strings ("3 days ago"). Returns null if unparseable —
 * candidates without a real date are dropped (never invented).
 */
export function parseDate(input: unknown, now = new Date()): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input > 1e12 ? input : input * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(input).trim();
  if (!s) return null;

  const gdelt = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (gdelt) {
    const [, y, mo, d, h, mi, se] = gdelt;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se));
  }

  const rel = s.match(/^(\d+)\s+(minute|min|hour|day|week|month)s?\s+ago$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("min")
      ? 60_000
      : unit === "hour"
        ? 3_600_000
        : unit === "day"
          ? 86_400_000
          : unit === "week"
            ? 604_800_000
            : 2_592_000_000;
    return new Date(now.getTime() - n * ms);
  }

  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    // Guard against nonsense (future or pre-2000) dates.
    if (d.getTime() > now.getTime() + 2 * 86_400_000 || d.getFullYear() < 2000) return null;
    return d;
  }
  return null;
}

/** Google-style snippets often start with "Oct 3, 2026 — …" or "3 days ago — …". */
export function leadingDate(text: string | undefined, now = new Date()): Date | null {
  if (!text) return null;
  const abs = text.match(new RegExp(`^\\s*((?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})`, "i"));
  if (abs) return parseDate(abs[1], now);
  const absDmy = text.match(new RegExp(`^\\s*(\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\.?\\s+\\d{4})`, "i"));
  if (absDmy) return parseDate(absDmy[1], now);
  const rel = text.match(/^\s*(\d+\s+(?:minute|min|hour|day|week|month)s?\s+ago)/i);
  if (rel) return parseDate(rel[1], now);
  return null;
}

/** "Accel (India)" → "Accel"; "Z47 (formerly Matrix Partners India)" → "Z47". */
export function firmShort(firm: string): string {
  return firm.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

/** Former names worth searching too, e.g. Z47 → "Matrix Partners India". */
export function firmAliases(firm: string): string[] {
  const out = [firmShort(firm)];
  const formerly = firm.match(/\(formerly\s+([^)]+)\)/i);
  if (formerly) out.push(formerly[1].trim());
  return out;
}

/** "William (Will) O'Donnell" → ["William O'Donnell", "Will O'Donnell"]; "Peter J. Holt" → [+ "Peter Holt"]. */
export function nameVariants(name: string): string[] {
  const variants = new Set<string>();
  const nick = name.match(/\(([^)]+)\)/);
  const base = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  variants.add(base);
  if (nick) {
    const parts = base.split(" ");
    variants.add([nick[1], ...parts.slice(1)].join(" "));
  }
  const noInitial = base.replace(/\s+[A-Z]\.\s+/g, " ");
  if (noInitial !== base) variants.add(noInitial);
  return [...variants];
}

export function quote(s: string): string {
  return `"${s.replace(/"/g, "")}"`;
}

export function withinDays(d: Date, days: number, now = new Date()): boolean {
  return now.getTime() - d.getTime() <= days * 86_400_000 && d.getTime() <= now.getTime() + 86_400_000;
}

export type SourceVc = Pick<Vc, "id" | "name" | "firm" | "blog_rss" | "linkedin_url">;
