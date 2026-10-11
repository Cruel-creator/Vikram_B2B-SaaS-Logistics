import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { env } from "./env";
import { SIGNAL_TYPES, type Candidate, type Classification, type ContactStatus, type Vc } from "./types";
import type { ScoredSignal } from "./scoring";
import { sleep } from "./sources/util";

/**
 * ALL AI in this project is Gemini Flash, and it is used for classification and
 * short write-ups ONLY — it never searches or recalls facts from memory. Every
 * signal's URL and date come from the live source, never from the model.
 */

const FALLBACK_CHAIN = ["gemini-3.6-flash", "gemini-3-flash-preview"];

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: env.geminiKey }));

/** Models that returned 404/unsupported are skipped for the rest of the process. */
const deadModels = new Set<string>();
export let lastModelUsed: string | null = null;

function modelChain(): string[] {
  return [...new Set([env.geminiModel, ...FALLBACK_CHAIN])].filter((m) => !deadModels.has(m));
}

// ── concurrency limiter (free-tier RPM): at most 2 in-flight requests ──
const MAX_CONCURRENCY = 2;
let active = 0;
const queue: Array<() => void> = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

function errStatus(e: unknown): number | undefined {
  const any = e as { status?: number; code?: number; message?: string };
  if (typeof any?.status === "number") return any.status;
  if (typeof any?.code === "number") return any.code;
  const m = String(any?.message ?? "").match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : undefined;
}

function retryDelayMs(e: unknown, attempt: number): number {
  const msg = String((e as { message?: string })?.message ?? "");
  const m = msg.match(/retry(?:Delay)?["\s:]*(?:in\s*)?"?(\d+(?:\.\d+)?)s/i);
  const hinted = m ? Number(m[1]) * 1000 : 0;
  const backoff = 2000 * 2 ** attempt + Math.random() * 1000;
  return Math.min(60_000, Math.max(hinted, backoff));
}

export async function generateJson<T>(prompt: string, schema: Schema, maxAttempts = 4): Promise<T> {
  return withSlot(async () => {
    let lastErr: unknown = new Error("No Gemini model available");
    for (const model of modelChain()) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const res = await ai().models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
          });
          const text = res.text;
          if (!text) throw new Error("Empty Gemini response");
          lastModelUsed = model;
          return JSON.parse(text) as T;
        } catch (e) {
          lastErr = e;
          const status = errStatus(e);
          if (status === 404 || /not found|not supported|unknown model/i.test(String((e as Error)?.message))) {
            deadModels.add(model);
            break; // try next model in chain
          }
          if (status === 429 || (status !== undefined && status >= 500) || e instanceof SyntaxError) {
            if (attempt < maxAttempts - 1) {
              await sleep(retryDelayMs(e, attempt));
              continue;
            }
            break; // quota exhausted on this model → next model has its own quota
          }
          throw e; // 400/401/403: config problem, surface it
        }
      }
    }
    throw lastErr;
  });
}

// ─────────────────────────────────────────────────────────────
// Classification — batches of ≤ 8 candidates per call
// ─────────────────────────────────────────────────────────────

const classifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          is_about_vc: { type: Type.BOOLEAN },
          signal_type: { type: Type.STRING, enum: [...SIGNAL_TYPES] },
          relevance: { type: Type.NUMBER },
          summary: { type: Type.STRING },
        },
        required: ["id", "is_about_vc", "signal_type", "relevance", "summary"],
        propertyOrdering: ["id", "is_about_vc", "signal_type", "relevance", "summary"],
      },
    },
  },
  required: ["items"],
};

const ORIGIN_HINT: Record<Candidate["origin"], string> = {
  person_query: "news search for the person's name + firm",
  firm_query: "news search for the FIRM's investments (person may not be named)",
  own_blog: "the investor's OWN blog/newsletter feed",
  firm_blog: "the firm's blog feed (may be written by a colleague)",
  web_search: "web search for the person's name + firm",
  linkedin: "the investor's own LinkedIn post",
};

export const CLASSIFY_BATCH = 8;

export async function classifyCandidates(
  vc: Pick<Vc, "name" | "firm" | "role" | "thesis" | "focus_tags">,
  candidates: Candidate[],
): Promise<Classification[]> {
  const listing = candidates
    .map(
      (c, i) =>
        `[${i}] source=${c.source} found_via="${ORIGIN_HINT[c.origin]}" published=${c.publishedAt.toISOString().slice(0, 10)}` +
        `${c.publisher ? ` publisher=${c.publisher}` : ""}\n    title: ${c.title.slice(0, 220)}\n    text: ${c.snippet.slice(0, 450) || "(none)"}`,
    )
    .join("\n");

  const prompt = `You classify evidence about a venture capital investor for a founder's outreach tracker.
Use ONLY the text given below. Do not use outside knowledge. Do not invent facts.

INVESTOR
name: ${vc.name}
firm: ${vc.firm}
role: ${vc.role ?? "n/a"}
thesis: ${vc.thesis ?? "n/a"}
focus: ${(vc.focus_tags ?? []).join(", ")}

FOUNDER CONTEXT: first-time founder raising a Seed round for a B2B logistics SaaS in India.

For each item return:
- is_about_vc: true ONLY if the item is clearly about THIS investor at THIS firm (they wrote it, are quoted/interviewed, spoke at/attended an event, or made/led an investment), OR it is the investor's own blog/LinkedIn post, OR (found via a firm investment search) it reports a specific new investment, fund or announcement BY THIS FIRM. Return false for namesakes, a different firm with a similar name, passing list mentions with no substance, or generic market roundups.
- signal_type: investment (they/their firm invested or led a round) | blog_post (they wrote an article/newsletter) | interview (quoted, podcast, interview) | event (speaking/attending/judging) | social_post (social media post) | news_mention (other coverage naming them) | other.
- relevance 0..1 to the founder: 1.0 = logistics, supply chain, freight, mobility or B2B SaaS at seed/early stage in India; 0.7 = B2B SaaS / enterprise software / India seed generally; 0.4 = other tech investing or fundraising market commentary; 0.1 = unrelated (consumer, personal, politics). Use 0 when is_about_vc is false.
- summary: ≤25 words, factual, third person, from the given text only (e.g. "Led ₹40 cr Series A in Shiprocket-like freight platform X"). Empty string when is_about_vc is false.

ITEMS
${listing}

Return one entry per item id.`;

  const out = await generateJson<{ items: Array<Classification & { id: number }> }>(prompt, classifySchema);
  const byId = new Map(out.items.map((x) => [x.id, x]));
  return candidates.map((_, i) => {
    const r = byId.get(i);
    if (!r) return { is_about_vc: false, signal_type: "other", relevance: 0, summary: "" };
    const type = (SIGNAL_TYPES as readonly string[]).includes(r.signal_type) ? r.signal_type : "other";
    return {
      is_about_vc: Boolean(r.is_about_vc),
      signal_type: type,
      relevance: Math.min(1, Math.max(0, Number(r.relevance) || 0)),
      summary: String(r.summary ?? "")
        .split(/\s+/)
        .slice(0, 28)
        .join(" ")
        .trim(),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Recommended action — one call per VC that has a signal
// ─────────────────────────────────────────────────────────────

const actionSchema: Schema = {
  type: Type.OBJECT,
  properties: { action: { type: Type.STRING } },
  required: ["action"],
};

const STATUS_LABEL: Record<ContactStatus, string> = {
  yet_to_reach_out: "has not contacted them yet",
  waiting_for_response: "emailed them and is waiting for a reply",
  in_conversation: "is already in conversation with them",
  passed: "was passed on by them",
};

export async function recommendAction(args: {
  vc: Pick<Vc, "name" | "firm" | "contact_status" | "last_contact_date">;
  top: ScoredSignal[];
  bucket: string;
  contactAgeDays: number | null;
}): Promise<string> {
  const { vc, top, bucket, contactAgeDays } = args;
  const signals = top
    .slice(0, 2)
    .map((s) => `- ${s.published_at.slice(0, 10)} (${s.signal_type}, ${s.ageDays}d ago): ${s.summary || s.title}`)
    .join("\n");
  const prompt = `Write ONE recommended next action for a founder (Vikram, Seed-stage B2B logistics SaaS, India) about investor ${vc.name} (${vc.firm}).
Vikram ${STATUS_LABEL[vc.contact_status]}${contactAgeDays !== null ? ` (last contact ${contactAgeDays} days ago)` : ""}.
Priority bucket: ${bucket}.
Recent signals (use only these facts):
${signals}

Rules: ≤30 words, imperative voice, cite the top signal concretely as the hook, tailor to the contact status (cold intro vs. polite nudge vs. continue conversation). No greetings, no quotes, no emojis.`;
  const out = await generateJson<{ action: string }>(prompt, actionSchema, 3);
  return out.action.split(/\s+/).slice(0, 34).join(" ").trim();
}

/** Deterministic fallback when Gemini is unavailable or there is no signal to cite. */
export function templateAction(args: {
  vc: Pick<Vc, "name" | "contact_status">;
  top?: ScoredSignal;
  bucket: string;
  contactAgeDays: number | null;
}): string {
  const { vc, top, bucket, contactAgeDays } = args;
  const first = vc.name.replace(/\s*\([^)]*\)/, "").split(" ")[0];
  const hook = top ? (top.summary || top.title || "").replace(/\.$/, "") : "";
  if (vc.contact_status === "passed") return `Passed — no outreach. Revisit only if ${first} publishes a logistics/supply-chain thesis.`;
  if (!top) {
    if (vc.contact_status === "waiting_for_response")
      return `No recent signal. Leave the thread; send a light update with new traction in 2–3 weeks.`;
    if (vc.contact_status === "in_conversation") return `Keep the conversation moving with a crisp traction update; no new public signal to reference.`;
    return `Deprioritize: no public activity in 60 days. Re-check next run before cold outreach.`;
  }
  if (vc.contact_status === "waiting_for_response") {
    if (contactAgeDays !== null && contactAgeDays < 7) return `Give ${first} time (contacted ${contactAgeDays}d ago). If no reply by day 14, nudge referencing: ${hook}.`;
    return `Nudge ${first} on the existing thread, referencing: ${hook}. Add one new traction metric.`;
  }
  if (vc.contact_status === "in_conversation") return `Reference "${hook}" in your next update to ${first} and propose a concrete next step.`;
  return bucket === "reach_out"
    ? `Cold-email ${first} this week, opening with: ${hook}. Tie it to your logistics SaaS traction.`
    : `Watch ${first}: ${hook}. Reach out if a fresher, logistics-relevant signal appears.`;
}
