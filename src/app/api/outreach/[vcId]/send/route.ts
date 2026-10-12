import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bearerOk, unauthorized } from "@/lib/chain";
import { env } from "@/lib/env";
import { deckRecipient, loadOutreach } from "@/lib/outreach/context";
import { buildDeck, deckFileName } from "@/lib/outreach/deck";
import { buildMime, createDraft, gmailConfigured, sendDraft } from "@/lib/outreach/gmail";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  mode: z.enum(["eml", "gmail_draft", "gmail_send"]),
});

/**
 * eml          → returns a .eml file (deck attached) that opens as a draft in Outlook/Apple Mail. Public.
 * gmail_draft  → creates a Gmail draft in Vikram's mailbox with the deck attached. ADMIN_TOKEN.
 * gmail_send   → creates the draft and sends it. ADMIN_TOKEN; refuses while [placeholders] remain.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ vcId: string }> }) {
  const { vcId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the To address, subject and body." }, { status: 400 });
  const b = parsed.data;

  if (b.mode !== "eml") {
    if (!bearerOk(req, env.adminToken)) return unauthorized();
    if (!gmailConfigured()) return NextResponse.json({ error: "Gmail isn't connected yet." }, { status: 501 });
  }
  if (b.mode === "gmail_send" && /\[[^\]]+\]/.test(`${b.subject}\n${b.body}`)) {
    return NextResponse.json({ error: "Replace the [placeholders] before sending." }, { status: 422 });
  }

  const ctx = await loadOutreach(vcId);
  if (!ctx) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pdf = await buildDeck(deckRecipient(ctx));
  const mail = {
    to: b.to,
    subject: b.subject,
    body: b.body,
    attachment: { filename: deckFileName(ctx.vc.firm), content: pdf, mime: "application/pdf" },
  };

  const log = (channel: string, externalId: string | null) =>
    db()
      .from("outreach_log")
      .insert({ vc_id: ctx.vc.id, channel, to_email: b.to, subject: b.subject, body: b.body, external_id: externalId });

  if (b.mode === "eml") {
    await log("eml_download", null);
    return new NextResponse(buildMime({ ...mail, draftHeader: true }), {
      headers: {
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${ctx.vc.name.replace(/[^A-Za-z0-9]+/g, "-")}-outreach.eml"`,
      },
    });
  }

  try {
    const { draftId, messageId } = await createDraft(mail);
    if (b.mode === "gmail_draft") {
      await log("gmail_draft", draftId);
      return NextResponse.json({ ok: true, draftId, url: `https://mail.google.com/mail/#drafts?compose=${messageId}` });
    }
    const sentId = await sendDraft(draftId);
    await log("gmail_send", sentId);
    return NextResponse.json({ ok: true, sentId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
