import { listCases } from "../storage/cases";
import { createCaseAudited, runAnalysisAudited } from "../storage/service";
import { appendAudit } from "../storage/audit";
import { caseInputSchema } from "../validation/case-schema";
import { DEMO_CASES } from "./cases";

/** Idempotent: a demo case is created only if no case with the same demo key exists. */
export async function seedDemoCases(actor: string) {
  const existing = new Map(listCases().filter((c) => c.demoKey).map((c) => [c.demoKey!, c.id]));
  const out: { key: string; caseId: string; created: boolean; analysisId?: string }[] = [];
  for (const d of DEMO_CASES) {
    if (existing.has(d.key)) { out.push({ key: d.key, caseId: existing.get(d.key)!, created: false }); continue; }
    const rec = await createCaseAudited(caseInputSchema.parse(d.input), actor, d.key);
    const a = await runAnalysisAudited(rec.id, actor);
    out.push({ key: d.key, caseId: rec.id, created: true, analysisId: a.analysisId });
  }
  await appendAudit({ event: "demo.seeded", actor, payload: { created: out.filter((x) => x.created).map((x) => x.key) } });
  return out;
}
