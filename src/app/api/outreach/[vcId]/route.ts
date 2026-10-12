import { NextResponse, type NextRequest } from "next/server";
import { canRegenerate, getDraft, loadOutreach } from "@/lib/outreach/context";
import { deckFileName } from "@/lib/outreach/deck";
import { FOUNDER } from "@/lib/outreach/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ vcId: string }> };

async function payload(vcId: string, force: boolean) {
  const ctx = await loadOutreach(vcId);
  if (!ctx) return null;
  const draft = await getDraft(ctx, force);
  return {
    vc: { id: ctx.vc.id, name: ctx.vc.name, firm: ctx.vc.firm, role: ctx.vc.role, location: ctx.vc.location, linkedinUrl: ctx.vc.linkedin_url },
    contact: ctx.contact && {
      name: ctx.contact.name,
      title: ctx.contact.title,
      email: ctx.contact.email,
      emailKind: ctx.contact.email_status,
      source: ctx.contact.source,
      sourceUrl: ctx.contact.source_ref,
      linkedinUrl: ctx.contact.linkedin_url ?? ctx.vc.linkedin_url,
      city: ctx.contact.city,
    },
    brand: {
      accent: ctx.brand?.accent ?? null,
      logo: ctx.brand?.logo_png ? `data:image/png;base64,${ctx.brand.logo_png}` : null,
      logoBg: ctx.brand?.logo_bg ?? null,
      domain: ctx.brand?.domain ?? null,
    },
    founder: { company: FOUNDER.company, oneLiner: FOUNDER.oneLiner, firstName: FOUNDER.firstName },
    deck: { url: `/deck/${ctx.vc.id}`, fileName: deckFileName(ctx.vc.firm) },
    draft,
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { vcId } = await params;
  const p = await payload(vcId, false);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "not found" }, { status: 404 });
}

/** Regenerate the draft (public, throttled to once per 10 minutes per investor). */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { vcId } = await params;
  if (!(await canRegenerate(vcId))) {
    return NextResponse.json({ error: "Regenerated recently. Try again in a few minutes." }, { status: 429 });
  }
  const p = await payload(vcId, true);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "not found" }, { status: 404 });
}
