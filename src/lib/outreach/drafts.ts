import { Type, type Schema } from "@google/genai";
import { generateJson, lastModelUsed } from "../gemini";
import { TYPE_LABEL, fmtDate } from "../format";
import type { ScoredSignal } from "../scoring";
import type { ContactStatus } from "../types";
import { FOUNDER } from "./founder";

/**
 * Outreach copy. Gemini Flash writes it under strict style rules, then a deterministic
 * linter rejects the usual AI tells; anything that fails twice falls back to a plain,
 * hand-written template. Only facts from the signal and FOUNDER are allowed.
 */

export interface DraftInput {
  name: string;
  firm: string;
  status: ContactStatus;
  lastContactDate: string | null;
  top: Pick<ScoredSignal, "summary" | "title" | "published_at" | "signal_type"> | null;
  second: Pick<ScoredSignal, "summary" | "title" | "published_at" | "signal_type"> | null;
}

export interface Draft {
  subject: string;
  body: string;
  linkedin: string;
  model: string;
}

const BANNED: Array<[RegExp, string]> = [
  [/hope (this|you|all)/i, "'hope this finds you'"],
  [/reach(ing)? out/i, "'reaching out'"],
  [/came across/i, "'came across'"],
  [/\b(excited|thrilled|passionate|delighted)\b/i, "hype adjectives"],
  [/revolution|game[- ]?chang|cutting[- ]edge|world[- ]class|best[- ]in[- ]class|next[- ]gen/i, "hype phrases"],
  [/leverag|synerg|\bdelve|seamless|robust|unlock|empower|transform|disrupt|landscape|paradigm|holistic/i, "buzzwords"],
  [/in today'?s|fast[- ]paced|ever[- ]changing/i, "filler openers"],
  [/i'?d love to|looking forward|touch base|circle back|quick question|just wanted|i wanted to/i, "stock phrases"],
  [/impressive|i admire|huge fan|big fan|resonat|inspiring|truly|deeply/i, "flattery"],
  [/—/, "em dashes"],
  [/!/, "exclamation marks"],
];

export function lintEmail(subject: string, body: string, firstName: string): string[] {
  const issues: string[] = [];
  for (const [re, label] of BANNED) if (re.test(subject) || re.test(body)) issues.push(label);
  const words = body.trim().split(/\s+/).length;
  if (words > 140) issues.push(`too long (${words} words, max 140)`);
  if (words < 45) issues.push(`too short (${words} words)`);
  if (!new RegExp(`\\b${firstName}\\b`).test(body)) issues.push("doesn't greet by first name");
  if (subject.split(/\s+/).length > 8) issues.push("subject over 8 words");
  return issues;
}

export function lintLinkedin(note: string): string[] {
  const issues: string[] = [];
  for (const [re, label] of BANNED) if (re.test(note)) issues.push(label);
  if (note.length > 300) issues.push(`over 300 characters (${note.length})`);
  return issues;
}

const firstName = (name: string) => name.replace(/\([^)]*\)/g, "").trim().split(/\s+/)[0];

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    linkedin: { type: Type.STRING },
  },
  required: ["subject", "body", "linkedin"],
  propertyOrdering: ["subject", "body", "linkedin"],
};

function signalLine(s: DraftInput["top"]): string {
  if (!s) return "none";
  return `${TYPE_LABEL[s.signal_type ?? "other"]} on ${fmtDate(s.published_at, { day: "numeric", month: "long" })}: ${s.summary || s.title}`;
}

function prompt(i: DraftInput, feedback?: string[]): string {
  const fn = firstName(i.name);
  const followUp = i.status === "waiting_for_response";
  return `Write a cold email and a LinkedIn connection note from a founder to an investor. Plain, specific, human.

FROM: ${FOUNDER.firstName}, founder of ${FOUNDER.company}: ${FOUNDER.oneLiner}.
Traction (copy EXACTLY, keep the square-bracket placeholders): ${FOUNDER.traction}.
Raising (copy EXACTLY, keep the placeholder): ${FOUNDER.ask}.
TO: ${i.name} (${fn}) at ${i.firm}.
${followUp ? `This is a FOLLOW-UP: ${FOUNDER.firstName} emailed on ${i.lastContactDate ? fmtDate(i.lastContactDate, { day: "numeric", month: "long" }) : "an earlier date"} with no reply yet.` : "First contact."}
Their most recent public signal: ${signalLine(i.top)}
${i.second ? `Another: ${signalLine(i.second)}` : ""}

EMAIL RULES
- Subject: 3 to 7 words, lowercase except names, specific to the signal or the company. No colons-as-clickbait, no "quick question".
- Body: 60 to 120 words, 4 short paragraphs, greeting "Hi ${fn},".
  1) ${followUp ? `Start with "Following up on my note from <that date>." Then ` : ""}one plain sentence on the signal with a concrete detail from it. Then ONE sentence on why you are writing to this person, claiming only a link the facts support: if the signal is about logistics, freight, supply chain, mobility or B2B operations software, say how it relates to ${FOUNDER.company}; otherwise say plainly that you are writing because ${i.firm} backs early B2B software. Never claim similarities that aren't stated above, and never say ${FOUNDER.company} does anything beyond the FROM line. No praise.
  2) What ${FOUNDER.company} does in one sentence, then the traction sentence with its placeholders.
  3) The raise in one sentence, then: "The deck is attached."
  4) A concrete ask: a 20-minute call next week. Then sign off on two lines: "${FOUNDER.signoff.replace("\n", " / ")}".
- Write like a busy operator: short sentences, plain verbs, no adjectives stacked, no flattery, no hype.
- Never use: "hope this finds you", "reaching out", "came across", "excited", "passionate", "leverage", "synergy", "game-changer", "revolutionize", "seamless", "empower", "transform", "disrupt", "landscape", "I'd love to", "looking forward", "impressive", "resonated", em dashes, exclamation marks.
- Only use facts given above. Do not invent numbers, customers, mutual connections or meetings.
- Use the investor's first name, never gendered pronouns.

LINKEDIN NOTE RULES
- Max 280 characters. Greeting "Hi ${fn},". One line on the signal, one line on ${FOUNDER.company}, ask if you can send the deck. Sign "${FOUNDER.firstName}". Same banned words; no placeholders in the note.
${feedback?.length ? `\nYOUR PREVIOUS DRAFT WAS REJECTED FOR: ${feedback.join("; ")}. Fix every one.` : ""}`;
}

export function templateDraft(i: DraftInput): Draft {
  const fn = firstName(i.name);
  const s = i.top;
  const when = s ? fmtDate(s.published_at, { day: "numeric", month: "long" }) : null;
  const lead: Record<string, string> = {
    investment: `Saw the news on ${when}`,
    blog_post: `I read your post from ${when}`,
    interview: `I read your interview from ${when}`,
    event: `Saw your session on ${when}`,
    social_post: `Saw your post from ${when}`,
  };
  const hook = s
    ? `${lead[s.signal_type ?? ""] ?? `Saw the coverage on ${when}`}: ${(s.summary || s.title || "").replace(/\.$/, "")}.`
    : `I'm writing because ${i.firm} backs early B2B software in India.`;
  const follow = i.status === "waiting_for_response" ? "Following up on my earlier note. " : "";
  const body = `Hi ${fn},

${follow}${hook} It is close to what we are building at ${FOUNDER.company}.

${FOUNDER.company} is ${FOUNDER.oneLiner}. We are at ${FOUNDER.traction}.

We are raising ${FOUNDER.ask}. The deck is attached.

Would you have 20 minutes for a call next week?

${FOUNDER.signoff}`;
  const linkedin = `Hi ${fn}, ${s ? `read your ${TYPE_LABEL[s.signal_type ?? "other"].toLowerCase()} from ${when}.` : `${i.firm} backs B2B software early.`} I'm building ${FOUNDER.company}: ${FOUNDER.oneLiner}. Raising our seed. Could I send you the deck? ${FOUNDER.firstName}`.slice(0, 300);
  return { subject: `${FOUNDER.company}, seed round for fleet software`, body, linkedin, model: "template" };
}

export async function writeDraft(i: DraftInput): Promise<Draft> {
  let feedback: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await generateJson<{ subject: string; body: string; linkedin: string }>(prompt(i, feedback), schema, 3);
      const subject = out.subject.trim().replace(/^subject:\s*/i, "");
      const body = out.body.trim().replace(/\r\n/g, "\n");
      const linkedin = out.linkedin.trim();
      const issues = [...lintEmail(subject, body, firstName(i.name)), ...lintLinkedin(linkedin).map((x) => `LinkedIn: ${x}`)];
      if (issues.length === 0) return { subject, body, linkedin, model: lastModelUsed ?? "gemini" };
      feedback = issues;
    } catch {
      break;
    }
  }
  return templateDraft(i);
}
