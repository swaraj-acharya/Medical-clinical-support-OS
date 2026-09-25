import { describe, expect, it } from "vitest";
import { evaluateRedFlags } from "../../lib/safety/red-flags";
import { checkDrugSafety, reviewCurrentRegimen } from "../../lib/safety/medication";
import { idx, mkCase, stateOf } from "../helpers";

const i = idx();
const drug = (id: string) => i.drug.get(id)!;
const rf = (c: ReturnType<typeof mkCase>) => evaluateRedFlags(c, stateOf(c, i), i);

describe("red-flag engine", () => {
  it("clears a benign presentation but says absence of data is not absence of risk", () => {
    const r = rf(mkCase());
    expect(r.status).toBe("clear");
    expect(r.blocked).toBe(false);
    expect(r.note).toMatch(/not absence of risk/);
  });
  it("blocks on thunderclap headache (emergency)", () => {
    const r = rf(mkCase({ complaint: { redFlagChecks: ["flag_thunderclap"] } }));
    expect(r.status).toBe("emergency");
    expect(r.blocked).toBe(true);
    expect(r.findings.map((f) => f.ruleId)).toContain("rf_thunderclap_headache");
    expect(r.findings[0].sources.length).toBeGreaterThan(0);
  });
  it("detects sudden-onset headache from structured detail as well as the checklist", () => {
    const c = mkCase({ complaint: { symptoms: [{ conceptId: "sym_headache", onset: "sudden", severity: "severe", triggers: [], aggravating: [], relieving: [] }] } });
    expect(rf(c).status).toBe("emergency");
  });
  it("marks headache in pregnancy as urgent (population rule)", () => {
    const r = rf(mkCase({ patient: { pregnancyStatus: "pregnant", gestationalWeeks: 26 } }));
    expect(r.status).toBe("urgent");
    expect(r.findings.map((f) => f.ruleId)).toContain("rf_pregnancy_headache");
  });
  it("does not apply pregnancy rules to a male patient", () => {
    const r = rf(mkCase({ patient: { sex: "male", pregnancyStatus: "pregnant" } }));
    expect(r.findings.map((f) => f.ruleId)).not.toContain("rf_pregnancy_headache");
  });
  it("uses vital-sign thresholds and reports missing vitals", () => {
    const low = rf(mkCase({ vitals: { spo2: 88, temperatureC: 37, heartRate: 90, respiratoryRate: 18, systolicBP: 120, diastolicBP: 80, gcs: 15 } }));
    expect(low.status).not.toBe("clear");
    const none = rf(mkCase({ vitals: {} }));
    expect(none.missingVitals).toEqual(expect.arrayContaining(["spo2"]));
  });
});

describe("medication safety", () => {
  it("excludes a drug the patient is allergic to (class-level)", () => {
    const r = checkDrugSafety(drug("drug_ibuprofen"), stateOf(mkCase({ patient: { allergies: [{ substance: "NSAIDs", severity: "severe" }] } }), i), i);
    expect(r.status).toBe("excluded");
    expect(r.exclusionReasons.join(" ")).toMatch(/allergy/i);
  });
  it("applies pregnancy contraindications from 20 weeks", () => {
    const r = checkDrugSafety(drug("drug_ibuprofen"), stateOf(mkCase({ patient: { pregnancyStatus: "pregnant", gestationalWeeks: 30 } }), i), i);
    expect(r.status).toBe("excluded");
  });
  it("applies age rules (aspirin under 16)", () => {
    const r = checkDrugSafety(drug("drug_aspirin"), stateOf(mkCase({ patient: { ageYears: 12 } }), i), i);
    expect(r.status).toBe("excluded");
  });
  it("applies renal rules from eGFR", () => {
    const st = stateOf(mkCase({ labs: { egfr: 22 } }), i);
    expect(st.tags.has("renal-severe")).toBe(true);
    expect(checkDrugSafety(drug("drug_ibuprofen"), st, i).status).toBe("excluded");
  });
  it("excludes NSAIDs when fever makes dengue a risk, unless the clinician asserts dengue is excluded", () => {
    const fever = { complaint: { associatedSymptomIds: ["sym_fever"] } };
    expect(checkDrugSafety(drug("drug_ibuprofen"), stateOf(mkCase(fever), i), i).status).toBe("excluded");
    expect(checkDrugSafety(drug("drug_ibuprofen"), stateOf(mkCase({ ...fever, clinicalAssertions: ["dengue-excluded"] }), i), i).status).not.toBe("excluded");
  });
  it("flags major drug–drug interactions (warfarin + aspirin)", () => {
    const r = checkDrugSafety(drug("drug_aspirin"), stateOf(mkCase({ medications: [{ name: "warfarin" }] }), i), i);
    expect(r.status).toBe("excluded");
    expect(r.findings.some((f) => f.level === "interaction" && /major/.test(f.title))).toBe(true);
  });
  it("detects duplicate ingredients hidden in a combination brand", () => {
    const r = checkDrugSafety(drug("drug_paracetamol"), stateOf(mkCase({ medications: [{ name: "Combiflam" }] }), i), i);
    expect(r.status).toBe("excluded");
    expect(r.exclusionReasons.join(" ")).toMatch(/duplicate/i);
  });
  it("reviews the current regimen independently of candidates", () => {
    const f = reviewCurrentRegimen(stateOf(mkCase({ medications: [{ name: "Warfarin" }, { name: "Combiflam" }] }), i), i);
    expect(f.some((x) => x.level === "high-risk" && /Warfarin/.test(x.title))).toBe(true);
  });
  it("discloses missing pregnancy data rather than implying safety", () => {
    const st = stateOf(mkCase({ patient: { pregnancyStatus: "pregnant", gestationalWeeks: 10 } }), i);
    const without = [...i.drug.values()].find((d) => ![...d.contraindications, ...d.warnings].some((r) => r.when.some((w) => w.startsWith("pregnan"))));
    if (without) expect(checkDrugSafety(without, st, i).findings.some((f) => /Pregnancy data not recorded/.test(f.title))).toBe(true);
  });
});

describe("allergy cross-reactivity and current-regimen review (regression)", () => {
  it("an ibuprofen allergy excludes NSAIDs but not paracetamol", async () => {
    const { mkCase, idx } = await import("../helpers");
    const { analyzeCase } = await import("../../lib/engines/analyze");
    const c = mkCase({ patient: { allergies: [{ substance: "Ibuprofen", severity: "moderate" }] } as never, systems: ["allopathy"] });
    const a = analyzeCase(c, { caseId: "case_000000000000", idx: idx() });
    expect(a.allopathy!.excluded.map((e) => e.entityId)).toEqual(expect.arrayContaining(["drug_ibuprofen", "drug_aspirin"]));
    expect(a.allopathy!.candidates.map((x) => x.entityId)).toContain("drug_paracetamol");
  });
  it("flags a current medicine that is contraindicated by organ function (metformin, eGFR < 30)", async () => {
    const { mkCase, idx } = await import("../helpers");
    const { analyzeCase } = await import("../../lib/engines/analyze");
    const c = mkCase({ medications: [{ name: "Metformin 500 mg" }] as never, labs: { egfr: 24 } as never, systems: ["allopathy"] });
    const a = analyzeCase(c, { caseId: "case_000000000000", idx: idx() });
    expect(a.regimenReview.some((f) => /Metformin/.test(f.title) && f.level === "high-risk")).toBe(true);
  });
});
