import { z } from "zod";
import { ok } from "@/lib/api";
import { repertorize } from "@/lib/engines/repertory";
import { assertSameOrigin, handleError, parseJson } from "@/lib/security/request";
import { idSchema } from "@/lib/validation/case-schema";

export const dynamic = "force-dynamic";
const body = z.object({ rubrics: z.array(z.object({ rubricId: idSchema, weight: z.number().int().min(1).max(3).default(1) })).min(1).max(40) });

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const p = await parseJson(req, body);
  if ("error" in p) return p.error;
  try {
    return ok(repertorize(p.data.rubrics, { limit: 30 }));
  } catch (e) { return handleError(e, "POST /api/repertory/repertorize"); }
}
