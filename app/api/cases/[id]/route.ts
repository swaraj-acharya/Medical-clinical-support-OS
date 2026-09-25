import { ok } from "@/lib/api";
import { handleError } from "@/lib/security/request";
import { getCase } from "@/lib/storage/cases";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return ok(getCase(id));
  } catch (e) { return handleError(e, "GET /api/cases/[id]"); }
}
