import { ok } from "@/lib/api";
import { seedDemoCases } from "@/lib/demo/seed";
import { actorFrom, assertSameOrigin, handleError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  if (process.env.CDS_DISABLE_DEMO === "true") return ok({ error: "Demo seeding disabled" }, 403);
  try {
    return ok({ results: await seedDemoCases(actorFrom(req)) });
  } catch (e) { return handleError(e, "POST /api/demo/seed"); }
}
