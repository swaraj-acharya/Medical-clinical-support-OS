import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEMO_CASES } from "../../lib/demo/cases";
import { analyzeCase } from "../../lib/engines/analyze";
import { caseToFhirBundle, fhirBundleToCaseDraft } from "../../lib/fhir/fhir";
import { deterministicExtract, extractConcepts } from "../../lib/ai/extract";
import { globalSearch } from "../../lib/search/global";
import { caseInputSchema } from "../../lib/validation/case-schema";
import { idx } from "../helpers";

const i = idx();
const run = (key: string, ack?: Parameters<typeof analyzeCase>[1]["acknowledgement"]) => analyzeCase(caseInputSchema.parse(DEMO_CASES.find((d) => d.key === key)!.input), { caseId: "case_000000000000", idx: i, acknowledgement: ack });

describe("analysis pipeline on the fictional demo cases", () => {
  it("homeopathy headache: repertory candidates, migraine context, knowledge-base version stamped", () => {
    const a = run("homeopathy-headache");
    expect(a.redFlags.status).toBe("clear");
    expect(a.knowledgeBaseVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(a.contexts.find((c) => c.qualifies)?.contextId).toBe("ctx_migraine");
    expect(a.homeopathy!.candidates.length).toBeGreaterThan(3);
    expect(a.homeopathy!.candidates.map((c) => c.abbrev)).toContain("Bell.");
    expect(a.conflicts.some((c) => c.topic === "Homeopathy evidence")).toBe(true);
    expect(a.mode).toBe("deterministic");
  });
  it("tension-type headache: allopathy candidates with guideline sources", () => {
    const a = run("allopathy-tension-headache");
    expect(a.allopathy!.candidates.map((c) => c.entityId)).toEqual(expect.arrayContaining(["drug_paracetamol", "drug_ibuprofen"]));
    expect(a.ayurveda).toBeUndefined();
  });
  it("amlapitta: Ayurvedic formulations surfaced with dosha support and Rasaushadhi cautions", () => {
    const a = run("ayurveda-amlapitta");
    const ay = a.ayurveda!;
    expect(ay.candidates.some((c) => c.kind === "formulation")).toBe(true);
    expect(ay.candidates.some((c) => c.safety.some((f) => /Rasaushadhi/.test(f.title)))).toBe(true);
    expect(a.allopathy!.candidates.map((c) => c.entityId)).toEqual(expect.arrayContaining(["drug_omeprazole"]));
  });
  it("URTI with fever: NSAIDs excluded by the dengue rule, antibiotics flagged do-not-offer", () => {
    const a = run("comparison-urti-fever");
    expect(a.allopathy!.excluded.map((e) => e.entityId)).toContain("drug_ibuprofen");
    expect(a.allopathy!.candidates.map((c) => c.entityId)).toContain("drug_paracetamol");
    expect(a.allopathy!.advisories.some((x) => x.kind === "do-not-offer")).toBe(true);
    expect(a.allergyNormalization[0].tags).toContain("allergy:penicillin");
  });
  it("thunderclap headache: emergency blocks every system", () => {
    const a = run("redflag-thunderclap");
    expect(a.redFlags.status).toBe("emergency");
    expect(a.candidatesWithheld).toBe(true);
    expect(a.allopathy ?? a.ayurveda ?? a.homeopathy).toBeUndefined();
  });
  it("warfarin: interacting and duplicate candidates excluded; regimen interaction reported", () => {
    const a = run("interaction-warfarin");
    const ex = a.allopathy!.excluded.map((e) => e.entityId);
    expect(ex).toEqual(expect.arrayContaining(["drug_aspirin", "drug_ibuprofen", "drug_paracetamol"]));
    expect(a.allopathy!.candidates).toHaveLength(0);
    expect(a.allopathy!.notFound.join(" ")).toMatch(/excluded by the safety checks/);
    expect(a.regimenReview.some((f) => f.level === "high-risk")).toBe(true);
  });
  it("urgent pregnancy headache: withheld until an acknowledgement covers every urgent rule", () => {
    const a = run("urgent-pregnancy-headache");
    expect(a.redFlags.status).toBe("urgent");
    expect(a.candidatesWithheld).toBe(true);
    const partial = run("urgent-pregnancy-headache", { ruleIds: ["rf_other"], clinicianRef: "Dr-T", reason: "checked", at: new Date().toISOString() });
    expect(partial.candidatesWithheld).toBe(true);
    const ok = run("urgent-pregnancy-headache", { ruleIds: a.redFlags.findings.map((f) => f.ruleId!), clinicianRef: "Dr-T", reason: "BP 122/78, urine protein negative", at: new Date().toISOString() });
    expect(ok.candidatesWithheld).toBe(false);
    expect(ok.acknowledgement?.clinicianRef).toBe("Dr-T");
    // pregnancy safety still applies after acknowledgement
    expect(ok.allopathy!.excluded.map((e) => e.entityId)).toEqual(expect.arrayContaining(["drug_ibuprofen"]));
  });
});

describe("search, extraction and FHIR", () => {
  it("global search finds brands, Hinglish symptoms and remedies with match types", () => {
    expect(globalSearch("Combiflam", i)[0]).toMatchObject({ type: "medicine", matchType: "synonym" });
    expect(globalSearch("sar dard", i).find((h) => h.type === "symptom")?.id).toBe("sym_headache");
    expect(globalSearch("Bell.", i).some((h) => h.type === "remedy" && h.label === "Belladonna")).toBe(true);
  });
  it("deterministic extraction maps free text to concepts and brands", () => {
    const r = deterministicExtract("Sar dard aur bukhar, took Combiflam yesterday", i);
    expect(r.symptoms.map((s) => s.conceptId)).toEqual(expect.arrayContaining(["sym_headache", "sym_fever"]));
    expect(r.medications[0].drugIds.sort()).toEqual(["drug_ibuprofen", "drug_paracetamol"]);
  });
  it("AI extraction stays off unless explicitly configured", async () => {
    const r = await extractConcepts("headache", i, { CDS_AI_MODE: "extract", ANTHROPIC_API_KEY: "x" } as unknown as NodeJS.ProcessEnv);
    expect(r.mode).toBe("deterministic");
    expect(r.notes.join(" ")).toMatch(/CDS_AI_ALLOW_CLINICAL_TEXT/);
  });
  it("imports a Synthea-style FHIR bundle without guessing unmapped conditions", () => {
    const b = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/fhir-bundle.json"), "utf8"));
    const { draft, unmapped } = fhirBundleToCaseDraft(b, i, new Date("2026-09-25"));
    expect(draft.patient?.ageYears).toBe(36);
    expect(draft.complaint?.symptoms.map((s) => s.conceptId)).toEqual(["sym_headache", "sym_fever"]);
    expect(unmapped).toEqual(["Prediabetes"]);
    expect(draft.vitals).toMatchObject({ temperatureC: 38.4, heartRate: 96 });
    expect(caseInputSchema.safeParse({ history: {}, ...draft }).success).toBe(true);
  });
  it("exports a case as a FHIR collection bundle with LOINC vital signs", () => {
    const c = caseInputSchema.parse(DEMO_CASES[0].input);
    const b = caseToFhirBundle("case_000000000000", c, i) as { entry: { resource: Record<string, any> }[] };
    const obs = b.entry.map((e) => e.resource).filter((r) => r.resourceType === "Observation");
    expect(obs.find((o) => o.code.coding[0].code === "8310-5")?.valueQuantity.value).toBe(36.8);
    expect(b.entry.find((e) => e.resource.resourceType === "Patient")!.resource.identifier[0].value).toBe("DEMO-H01");
  });
});
