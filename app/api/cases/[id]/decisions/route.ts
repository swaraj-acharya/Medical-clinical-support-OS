import { ok } from "@/lib/api";
import { assertSameOrigin, handleError, parseJson } from "@/lib/security/request";
import { recordDecisionAudited } from "@/lib/storage/service";
import { decisionBaseSchema, decisionRules, idSchema } from "@/lib/validation/case-schema";

export const dynamic = "force-dynamic";
const body = decisionBaseSchema.extend({ analysisId: idSchema }).superRefine(decisionRules);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const p = await parseJson(req, body);
  if ("error" in p) return p.error;
  try {
    const { id } = await params;
    const { analysisId, ...d } = p.data;
    return ok(await recordDecisionAudited(id, analysisId, d, d.clinicianRef), 201);
  } catch (e) { return handleError(e, "POST /api/cases/[id]/decisions"); }
}
