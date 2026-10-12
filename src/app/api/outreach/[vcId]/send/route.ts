import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deckRecipient, loadOutreach } from "@/lib/outreach/context";
import { buildDeck, deckFileName } from "@/lib/outreach/deck";
import { buildMime } from "@/lib/outreach/mime";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

/** Returns a .eml draft (deck attached) that opens ready-to-send in Outlook / Apple Mail. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ vcId: string }> }) {
  const { vcId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the To address, subject and body." }, { status: 400 });
  const b = parsed.data;

  const ctx = await loadOutreach(vcId);
  if (!ctx) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pdf = await buildDeck(deckRecipient(ctx));

  await db()
    .from("outreach_log")
    .insert({ vc_id: ctx.vc.id, channel: "eml_download", to_email: b.to, subject: b.subject, body: b.body });

  const mime = buildMime({
    to: b.to,
    subject: b.subject,
    body: b.body,
    attachment: { filename: deckFileName(ctx.vc.firm), content: pdf, mime: "application/pdf" },
    draftHeader: true,
  });
  return new NextResponse(mime, {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="${ctx.vc.name.replace(/[^A-Za-z0-9]+/g, "-")}-outreach.eml"`,
    },
  });
}
