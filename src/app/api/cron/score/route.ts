import type { NextRequest } from "next/server";
import { handleCron } from "@/lib/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Mon & Thu 07:00 IST (vercel.json): recompute scores and write the 4 signal columns. */
export function GET(req: NextRequest) {
  return handleCron(req, "score", "score");
}
