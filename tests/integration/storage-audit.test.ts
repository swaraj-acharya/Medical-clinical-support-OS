import { rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_CASES } from "../../lib/demo/cases";
import { seedDemoCases } from "../../lib/demo/seed";
import { readAudit, verifyAuditChain } from "../../lib/storage/audit";
import { getAnalysis, getCase, listCases } from "../../lib/storage/cases";
import { runtimeDir } from "../../lib/storage/runtime";
import { acknowledgeAudited, createCaseAudited, recordDecisionAudited, runAnalysisAudited } from "../../lib/storage/service";
import { caseInputSchema } from "../../lib/validation/case-schema";

beforeAll(() => { rmSync(runtimeDir(), { recursive: true, force: true }); });

describe("storage, decisions and audit log", () => {
  it("creates a case, analyses it, records a decision — all audit-logged with the KB version", async () => {
    const rec = await createCaseAudited(caseInputSchema.parse(DEMO_CASES[1].input), "tester");
    const a = await runAnalysisAudited(rec.id, "tester");
    expect(getAnalysis(a.analysisId).caseId).toBe(rec.id);
    const cand = a.allopathy!.candidates[0];
    const d = await recordDecisionAudited(rec.id, a.analysisId, { candidateId: cand.id, system: "allopathy", action: "accepted", clinicianRef: "Dr-Test" }, "Dr-Test");
    expect(d.kbVersion).toBe(a.knowledgeBaseVersion);
    expect(getCase(rec.id).decisions).toHaveLength(1);
    const events = readAudit({ caseId: rec.id }).map((e) => e.event);
    expect(events).toEqual(["case.created", "analysis.run", "decision.recorded"]);
    const run = readAudit({ caseId: rec.id }).find((e) => e.event === "analysis.run")!;
    expect(run.kbVersion).toBe(a.knowledgeBaseVersion);
    expect((run.payload as { candidates: unknown[]; inputs: unknown }).candidates.length).toBeGreaterThan(0);
  });
  it("rejects decisions on candidates that are not in the analysis, or filed under the wrong system", async () => {
    const [c] = listCases();
    const a = getAnalysis(c.analyses[0].analysisId);
    await expect(recordDecisionAudited(c.id, a.analysisId, { candidateId: a.allopathy!.candidates[0].id, system: "homeopathy", action: "accepted", clinicianRef: "Dr-Test" }, "x")).rejects.toThrow(/belongs to allopathy/);
    await expect(recordDecisionAudited(c.id, c.analyses[0].analysisId, { candidateId: "allo:drug_nonexistent", system: "allopathy", action: "accepted", clinicianRef: "Dr-Test" }, "x")).rejects.toThrow(/not found/);
  });
  it("acknowledges urgent red flags (and refuses emergencies)", async () => {
    const urgent = await createCaseAudited(caseInputSchema.parse(DEMO_CASES.find((d) => d.key === "urgent-pregnancy-headache")!.input), "t");
    const a1 = await runAnalysisAudited(urgent.id, "t");
    expect(a1.candidatesWithheld).toBe(true);
    await expect(acknowledgeAudited(urgent.id, { acknowledgedRuleIds: ["rf_made_up"], clinicianRef: "Dr-T", reason: "checked BP" }, "t")).rejects.toThrow(/not present/);
    await acknowledgeAudited(urgent.id, { acknowledgedRuleIds: a1.redFlags.findings.map((f) => f.ruleId!), clinicianRef: "Dr-T", reason: "BP normal, no proteinuria" }, "t");
    const a2 = await runAnalysisAudited(urgent.id, "t");
    expect(a2.candidatesWithheld).toBe(false);
    const em = await createCaseAudited(caseInputSchema.parse(DEMO_CASES.find((d) => d.key === "redflag-thunderclap")!.input), "t");
    const a3 = await runAnalysisAudited(em.id, "t");
    await expect(acknowledgeAudited(em.id, { acknowledgedRuleIds: a3.redFlags.findings.map((f) => f.ruleId!), clinicianRef: "Dr-T", reason: "want candidates" }, "t")).rejects.toThrow(/Emergency/);
  });
  it("seeds demo cases idempotently", async () => {
    const first = await seedDemoCases("t");
    const second = await seedDemoCases("t");
    expect(first.filter((x) => x.created)).toHaveLength(DEMO_CASES.length);
    expect(second.filter((x) => x.created)).toHaveLength(0);
  });
  it("keeps an intact hash chain and detects tampering", () => {
    expect(verifyAuditChain()).toMatchObject({ ok: true });
    const f = path.join(runtimeDir(), "audit", "audit.jsonl");
    const original = readFileSync(f, "utf8");
    const lines = original.trim().split("\n");
    const e = JSON.parse(lines[1]);
    e.actor = "someone-else";
    lines[1] = JSON.stringify(e);
    writeFileSync(f, lines.join("\n") + "\n");
    expect(verifyAuditChain()).toMatchObject({ ok: false, brokenAt: 2 });
    const dropped = original.trim().split("\n");
    dropped.splice(1, 1);
    writeFileSync(f, dropped.join("\n") + "\n");
    expect(verifyAuditChain().ok).toBe(false);
    writeFileSync(f, original);
    expect(verifyAuditChain().ok).toBe(true);
  });
});
