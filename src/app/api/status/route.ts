import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, non-sensitive progress of the latest run (polled by the Run-now button). */
export async function GET() {
  const { data, error } = await db()
    .from("runs")
    .select("id, kind, trigger, status, stage, started_at, finished_at, vcs_processed, vcs_total, signals_new, protected_check")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 500 });
  return NextResponse.json({ run: data?.[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
}
