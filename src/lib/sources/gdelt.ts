import type { Candidate } from "../types";
import { fetchText, firmShort, HttpError, nameVariants, parseDate, quote, sleep, type SourceVc } from "./util";

// GDELT asks for ≤1 request / 5 s. A module-level promise chain serialises every
// caller (including concurrent VCs) so requests are always ≥ MIN_GAP_MS apart.
const MIN_GAP_MS = 6_000;
let gate: Promise<void> = Promise.resolve();
let lastCall = 0;

function politeGate(extraMs = 0): Promise<void> {
  const turn = gate.then(async () => {
    const wait = lastCall + MIN_GAP_MS + extraMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
  });
  gate = turn.catch(() => {});
  return turn;
}

// Circuit breaker: after repeated 429s, skip GDELT for a while instead of burning
// the invocation's time budget (GDELT failing is non-fatal; other sources continue).
let consecutive429 = 0;
let openUntil = 0;

async function gdeltFetch(url: string): Promise<string> {
  if (Date.now() < openUntil) throw new Error("GDELT: temporarily skipped after repeated rate limits");
  for (let attempt = 0; attempt < 2; attempt++) {
    await politeGate(attempt * 6_000);
    try {
      const text = await fetchText(url, { timeoutMs: 20_000, retries: 0 });
      consecutive429 = 0;
      return text;
    } catch (e) {
      // 429s and dropped connections ("fetch failed") are both GDELT throttling us.
      if ((e instanceof HttpError && e.status === 429) || !(e instanceof HttpError)) {
        if (++consecutive429 >= 4) {
          openUntil = Date.now() + 10 * 60_000;
          throw new Error("GDELT: rate limited (circuit open 10 min)");
        }
        if (attempt === 0) continue;
      }
      throw e;
    }
  }
  throw new Error("GDELT: rate limited");
}

type GdeltArticle = { url?: string; title?: string; seendate?: string; domain?: string; language?: string };

export async function gdeltPerson(vc: SourceVc, days: number): Promise<Candidate[]> {
  const name = quote(nameVariants(vc.name)[0]);
  const firm = firmShort(vc.firm);
  // GDELT rejects very short phrases; only add the firm when it is long enough to help.
  const query = firm.length >= 4 ? `${name} ${quote(firm)}` : name;
  // GDELT's max timespan is ~3 months; we only need the lookback window.
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}` +
    `&mode=ArtList&format=json&timespan=${days}d&maxrecords=50&sort=DateDesc`;

  const text = await gdeltFetch(url);
  let json: { articles?: GdeltArticle[] };
  try {
    json = JSON.parse(text);
  } catch {
    // GDELT returns plain-text errors (e.g. "phrase too short") with HTTP 200.
    throw new Error(`GDELT: ${text.slice(0, 120)}`);
  }
  const out: Candidate[] = [];
  for (const a of json.articles ?? []) {
    const publishedAt = parseDate(a.seendate);
    if (!a.url || !publishedAt) continue;
    if (a.language && a.language !== "English") continue;
    out.push({
      url: a.url,
      title: (a.title ?? "").trim(),
      snippet: "",
      source: "gdelt",
      publishedAt,
      origin: "person_query",
      publisher: a.domain,
    });
  }
  return out;
}
