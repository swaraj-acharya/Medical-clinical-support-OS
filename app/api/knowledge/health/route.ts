import { ok } from "@/lib/api";
import { getKnowledge, getRegistry, getValidationReport } from "@/lib/knowledge/store";
import { handleError } from "@/lib/security/request";
import { verifyAuditChain } from "@/lib/storage/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const kb = getKnowledge();
    const report = getValidationReport();
    return ok({
      version: kb.metadata.version, contentHash: kb.metadata.contentHash, generatedAt: kb.metadata.generatedAt, packs: kb.metadata.packs,
      validation: report ? { errors: report.errors.length, warnings: report.warnings.length, provenanceCoverage: report.provenance.coveragePercent } : null,
      sources: getRegistry().length, audit: verifyAuditChain(),
    });
  } catch (e) { return handleError(e, "GET /api/knowledge/health"); }
}
