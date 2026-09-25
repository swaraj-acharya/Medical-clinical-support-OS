import { ok } from "@/lib/api";
import { searchRubrics } from "@/lib/engines/repertory";
import { handleError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const q = (u.searchParams.get("q") ?? "").slice(0, 120);
    const chapter = u.searchParams.get("chapter")?.slice(0, 60) || undefined;
    return ok({ q, results: searchRubrics(q, { limit: 60, chapter }) });
  } catch (e) { return handleError(e, "GET /api/repertory/search"); }
}
