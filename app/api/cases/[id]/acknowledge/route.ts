import { ok } from "@/lib/api";
import { actorFrom, assertSameOrigin, handleError, parseJson } from "@/lib/security/request";
import { acknowledgeAudited, runAnalysisAudited } from "@/lib/storage/service";
import { acknowledgeSchema } from "@/lib/validation/case-schema";

export const dynamic = "force-dynamic";

/** Records that the clinician has assessed URGENT red flags, then re-runs the analysis. Emergency flags cannot be acknowledged. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const p = await parseJson(req, acknowledgeSchema);
  if ("error" in p) return p.error;
  try {
    const { id } = await params;
    await acknowledgeAudited(id, p.data, p.data.clinicianRef || actorFrom(req));
    const a = await runAnalysisAudited(id, p.data.clinicianRef);
    return ok({ analysisId: a.analysisId, candidatesWithheld: a.candidatesWithheld });
  } catch (e) { return handleError(e, "POST /api/cases/[id]/acknowledge"); }
}
