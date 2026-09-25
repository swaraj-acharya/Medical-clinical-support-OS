import { ok } from "@/lib/api";
import { childrenOf } from "@/lib/engines/repertory";
import { handleError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const path = new URL(req.url).searchParams.get("path");
    return ok({ path: path || null, children: childrenOf(path ? path.slice(0, 400) : null) });
  } catch (e) { return handleError(e, "GET /api/repertory/children"); }
}
