import { ok } from "@/lib/api";
import { getKnowledge, resetKnowledgeCache } from "@/lib/knowledge/store";
import { actorFrom, assertSameOrigin, handleError } from "@/lib/security/request";
import { appendAudit } from "@/lib/storage/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  try {
    resetKnowledgeCache();
    const kb = getKnowledge();
    await appendAudit({ event: "knowledge.reloaded", actor: actorFrom(req), kbVersion: kb.metadata.version, kbContentHash: kb.metadata.contentHash, payload: {} });
    return ok({ version: kb.metadata.version, contentHash: kb.metadata.contentHash });
  } catch (e) { return handleError(e, "POST /api/knowledge/reload"); }
}
