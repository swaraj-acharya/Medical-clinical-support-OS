import { ok } from "@/lib/api";
import { logEvent } from "@/lib/security/log";
import { actorFrom, assertSameOrigin, handleError } from "@/lib/security/request";
import { runAnalysisAudited } from "@/lib/storage/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  try {
    const { id } = await params;
    const t = Date.now();
    const a = await runAnalysisAudited(id, actorFrom(req));
    logEvent("analysis.run", { caseId: id, analysisId: a.analysisId, status: a.redFlags.status, ms: Date.now() - t });
    return ok({ analysisId: a.analysisId, redFlagStatus: a.redFlags.status, candidatesWithheld: a.candidatesWithheld });
  } catch (e) { return handleError(e, "POST /api/cases/[id]/analyze"); }
}
