import type { NextRequest } from "next/server";
import { handleCron } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily 06:00 IST (vercel.json): collect + classify new signals, chunked with a cursor. */
export function GET(req: NextRequest) {
  return handleCron(req, "ingest", "ingest");
}
