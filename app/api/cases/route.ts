import { ok } from "@/lib/api";
import { logEvent } from "@/lib/security/log";
import { actorFrom, assertSameOrigin, handleError, parseJson } from "@/lib/security/request";
import { listCases } from "@/lib/storage/cases";
import { createCaseAudited } from "@/lib/storage/service";
import { caseInputSchema } from "@/lib/validation/case-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(listCases().map((c) => ({ id: c.id, patientRef: c.input.patient.patientRef, createdAt: c.createdAt, updatedAt: c.updatedAt, chiefComplaintId: c.input.complaint.chiefComplaintId, analyses: c.analyses.length, decisions: c.decisions.length, lastStatus: c.analyses.at(-1)?.redFlagStatus ?? null })));
  } catch (e) { return handleError(e, "GET /api/cases"); }
}

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const p = await parseJson(req, caseInputSchema);
  if ("error" in p) return p.error;
  try {
    const rec = await createCaseAudited(p.data, actorFrom(req));
    logEvent("case.created", { caseId: rec.id });
    return ok({ id: rec.id }, 201);
  } catch (e) { return handleError(e, "POST /api/cases"); }
}
