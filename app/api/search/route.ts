import { ok } from "@/lib/api";
import { buildIndex } from "@/lib/knowledge/indexes";
import { getKnowledge } from "@/lib/knowledge/store";
import { globalSearch, type SearchType } from "@/lib/search/global";
import { handleError } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const TYPES = new Set(["symptom", "medicine", "herb", "formulation", "remedy", "rubric", "context", "guideline", "principle", "source", "red-flag"]);

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const q = (u.searchParams.get("q") ?? "").slice(0, 100);
    const types = (u.searchParams.get("types") ?? "").split(",").filter((t) => TYPES.has(t)) as SearchType[];
    const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit") ?? 40) || 40));
    return ok({ q, results: globalSearch(q, buildIndex(getKnowledge()), { limit, types: types.length ? types : undefined }) });
  } catch (e) { return handleError(e, "GET /api/search"); }
}
