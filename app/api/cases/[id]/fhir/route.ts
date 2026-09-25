import { ok } from "@/lib/api";
import { caseToFhirBundle } from "@/lib/fhir/fhir";
import { buildIndex } from "@/lib/knowledge/indexes";
import { getKnowledge } from "@/lib/knowledge/store";
import { handleError } from "@/lib/security/request";
import { getCase } from "@/lib/storage/cases";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = getCase(id);
    return ok(caseToFhirBundle(c.id, c.input, buildIndex(getKnowledge())));
  } catch (e) { return handleError(e, "GET /api/cases/[id]/fhir"); }
}
