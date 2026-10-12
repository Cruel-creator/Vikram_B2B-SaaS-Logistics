// Investor-facing deck link (/deck/{id}) used in outreach emails; same PDF as /api/deck/{id}.
export { GET } from "@/app/api/deck/[vcId]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
