import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bearerOk, unauthorized } from "@/lib/chain";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase";
import { CONTACT_STATUSES } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  vcId: z.string().uuid(),
  personalNotes: z.string().max(4000).nullable(),
  contactStatus: z.enum(CONTACT_STATUSES),
  lastContactDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

/** Vikram's manual edits. The ONLY app path that writes manual columns (via update_vc_manual). */
export async function POST(req: NextRequest) {
  if (!bearerOk(req, env.adminToken)) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const b = parsed.data;
  const { error } = await db().rpc("update_vc_manual", {
    p_vc_id: b.vcId,
    p_personal_notes: b.personalNotes?.trim() || null,
    p_contact_status: b.contactStatus,
    p_last_contact_date: b.lastContactDate,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
