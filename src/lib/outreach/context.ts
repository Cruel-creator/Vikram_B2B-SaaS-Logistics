import { env } from "../env";
import { loadRelevantSignals } from "../pipeline";
import { scoreVc, uniqueStories } from "../scoring";
import { db } from "../supabase";
import type { Vc } from "../types";
import { writeDraft, type Draft } from "./drafts";

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  city: string | null;
  source: string;
  source_ref: string | null;
}

export interface BrandRow {
  firm: string;
  domain: string | null;
  logo_png: string | null;
  logo_bg: "light" | "dark" | null;
  accent: string | null;
}

export interface OutreachContext {
  vc: Vc;
  contact: ContactRow | null;
  brand: BrandRow | null;
}

export async function loadOutreach(vcId: string): Promise<OutreachContext | null> {
  const { data: vc } = await db().from("vcs").select("*").eq("id", vcId).maybeSingle();
  if (!vc) return null;
  const [{ data: contacts }, { data: brand }] = await Promise.all([
    db().from("contacts").select("*").eq("vc_id", vcId),
    db().from("firm_brands").select("firm, domain, logo_png, logo_bg, accent").eq("firm", vc.firm).maybeSingle(),
  ]);
  // Prefer a contact with an email; Apollo/manual entries outrank website ones when present.
  const order = ["manual", "apollo", "website"];
  const contact =
    ((contacts ?? []) as ContactRow[]).sort(
      (a, b) => Number(Boolean(b.email)) - Number(Boolean(a.email)) || order.indexOf(a.source) - order.indexOf(b.source),
    )[0] ?? null;
  return { vc: vc as Vc, contact, brand: (brand as BrandRow) ?? null };
}

/** Everything the deck generator needs, from one place (deck route + send route). */
export function deckRecipient(ctx: OutreachContext) {
  return {
    name: ctx.contact?.name ?? ctx.vc.name,
    title: ctx.contact?.title ?? ctx.vc.role,
    firm: ctx.vc.firm,
    logoPngBase64: ctx.brand?.logo_png ?? null,
    logoBg: ctx.brand?.logo_bg ?? null,
    accent: ctx.brand?.accent ?? null,
  };
}

const STALE_MS = 3 * 86_400_000;

/** Cached draft, regenerated when missing, stale, or forced (callers rate-limit `force`). */
export async function getDraft(ctx: OutreachContext, force = false): Promise<Draft & { generatedAt: string }> {
  const { data: cached } = await db().from("outreach_drafts").select("*").eq("vc_id", ctx.vc.id).maybeSingle();
  const fresh = cached && Date.now() - Date.parse(cached.generated_at) < STALE_MS;
  if (cached && fresh && !force) {
    return {
      subject: cached.subject,
      body: cached.body,
      linkedin: cached.linkedin_note,
      model: cached.model ?? "",
      generatedAt: cached.generated_at,
    };
  }

  const signals = (await loadRelevantSignals([ctx.vc.id])).get(ctx.vc.id) ?? [];
  const r = scoreVc({
    status: ctx.vc.contact_status,
    lastContactDate: ctx.vc.last_contact_date,
    signals,
    activeDays: env.activeDays,
    lookbackDays: env.lookbackDays,
  });
  const stories = uniqueStories(r.scored, [ctx.vc.name, ctx.vc.firm]);
  const draft = await writeDraft({
    name: ctx.contact?.name ?? ctx.vc.name,
    firm: ctx.vc.firm,
    status: ctx.vc.contact_status,
    lastContactDate: ctx.vc.last_contact_date,
    top: stories[0] ?? null,
    second: stories[1] ?? null,
  });
  const generatedAt = new Date().toISOString();
  await db()
    .from("outreach_drafts")
    .upsert(
      { vc_id: ctx.vc.id, subject: draft.subject, body: draft.body, linkedin_note: draft.linkedin, model: draft.model, generated_at: generatedAt },
      { onConflict: "vc_id" },
    );
  return { ...draft, generatedAt };
}

/** Public-safe regenerate throttle: at most once per 10 minutes per investor. */
export async function canRegenerate(vcId: string): Promise<boolean> {
  const { data } = await db().from("outreach_drafts").select("generated_at").eq("vc_id", vcId).maybeSingle();
  return !data || Date.now() - Date.parse(data.generated_at) > 10 * 60_000;
}
