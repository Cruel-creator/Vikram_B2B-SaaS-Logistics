import { NextResponse, type NextRequest } from "next/server";
import { deckRecipient, loadOutreach } from "@/lib/outreach/context";
import { buildDeck, deckFileName } from "@/lib/outreach/deck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The illustrative deck with a cover personalised to this investor and their firm. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ vcId: string }> }) {
  const { vcId } = await params;
  const ctx = await loadOutreach(vcId);
  if (!ctx) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pdf = await buildDeck(deckRecipient(ctx));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${deckFileName(ctx.vc.firm)}"`,
      "Cache-Control": "no-store",
    },
  });
}
