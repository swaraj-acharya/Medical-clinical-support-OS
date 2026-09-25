import { z } from "zod";
import { ok } from "@/lib/api";
import { extractConcepts } from "@/lib/ai/extract";
import { buildIndex } from "@/lib/knowledge/indexes";
import { getKnowledge } from "@/lib/knowledge/store";
import { assertSameOrigin, handleError, parseJson } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const body = z.object({ text: z.string().trim().min(2).max(4000) });

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const p = await parseJson(req, body);
  if ("error" in p) return p.error;
  try {
    return ok(await extractConcepts(p.data.text, buildIndex(getKnowledge())));
  } catch (e) { return handleError(e, "POST /api/extract"); }
}
