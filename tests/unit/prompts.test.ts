import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "../../lib/demo/cases";
import { analyzeCase } from "../../lib/engines/analyze";
import { buildPrompt, DEFAULT_PROMPT_OPTIONS, pubmedQuery } from "../../lib/prompts/build";
import { analysisSpecs, caseSpec, drugSpec, herbSpec, repertorySpec, termSpec, verificationSpec } from "../../lib/prompts/specs";
import { caseInputSchema } from "../../lib/validation/case-schema";
import { idx, mkCase } from "../helpers";

const i = idx();
const ALL_ON = { ...DEFAULT_PROMPT_OPTIONS, includeFreeText: true };

describe("research prompt builder", () => {
  const spec = termSpec("Zerodol SP", { hint: "medicine", nearMatches: ["Paracetamol"] });
  it("always demands verifiable citations and forbids invented references", () => {
    const p = buildPrompt(spec);
    expect(p).toMatch(/Never invent references/);
    expect(p).toMatch(/PMID or DOI/);
    expect(p).toMatch(/If you cannot browse the internet/);
    expect(p).toContain("Zerodol SP");
  });
  it("changes method with depth: quick omits PubMed strings, systematic asks for PICO and GRADE", () => {
    expect(buildPrompt(spec, { ...DEFAULT_PROMPT_OPTIONS, depth: "quick" })).not.toContain("Suggested PubMed searches");
    const sys = buildPrompt(spec, { ...DEFAULT_PROMPT_OPTIONS, depth: "systematic" });
    expect(sys).toMatch(/PICO/);
    expect(sys).toMatch(/GRADE/);
    expect(sys).toMatch(/CTRI/);
  });
  it("respects the India-first / international option", () => {
    expect(buildPrompt(spec)).toMatch(/Prefer Indian sources/);
    expect(buildPrompt(spec, { ...DEFAULT_PROMPT_OPTIONS, jurisdiction: "international" })).not.toMatch(/Prefer Indian sources/);
  });
  it("builds valid-looking PubMed queries", () => {
    const q = pubmedQuery([["migraine", "headache"], ["sumatriptan"]], "sr", 2016);
    expect(q).toBe('("migraine"[tiab] OR "headache"[tiab]) AND "sumatriptan"[tiab] AND (systematic review[pt] OR meta-analysis[pt]) AND ("2016"[dp] : "3000"[dp])');
    expect(pubmedQuery([[]])).toBe("");
  });
});

describe("section prompts carry the section's data and stay de-identified", () => {
  for (const d of DEMO_CASES) {
    it(`demo ${d.key}: every analysis section yields a prompt without the patient reference`, () => {
      const c = caseInputSchema.parse(d.input);
      const a = analyzeCase(c, { caseId: "case_000000000000", idx: i });
      const specs = analysisSpecs(a, c, i);
      expect(Object.keys(specs)).toHaveLength(10);
      for (const s of Object.values(specs)) {
        const p = buildPrompt(s, ALL_ON);
        expect(p.length).toBeGreaterThan(800);
        expect(p).not.toContain(c.patient.patientRef);
        expect(p).toContain("Patient context (de-identified)");
      }
      if (a.redFlags.status === "emergency") expect(buildPrompt(specs.redFlags)).toMatch(/EMERGENCY/);
    });
  }

  it("lists unrecognised medicines as gaps to research", () => {
    const c = mkCase({ medications: [{ name: "Xyloquine forte 20" }] as never, systems: ["allopathy"] });
    const a = analyzeCase(c, { caseId: "case_000000000000", idx: i });
    const s = analysisSpecs(a, c, i).patientSummary;
    expect(s.gaps!.join(" ")).toContain("Xyloquine forte 20");
    expect(buildPrompt(s)).toMatch(/generic composition/);
  });

  it("switches the clinical-context prompt to 'not in the knowledge base' when no context matches", () => {
    const c = mkCase({ complaint: { chiefComplaintId: "sym_back_pain", symptoms: [{ conceptId: "sym_back_pain", triggers: [], aggravating: [], relieving: [] }], associatedSymptomIds: [], redFlagChecks: [] } as never, systems: ["allopathy"] });
    const a = analyzeCase(c, { caseId: "case_000000000000", idx: i });
    const s = analysisSpecs(a, c, i).clinicalContext;
    expect(s.title).toMatch(/not in the knowledge base/);
    expect(buildPrompt(s)).toMatch(/has no clinical context that matches/);
    expect(buildPrompt(analysisSpecs(a, c, i).allopathy)).toMatch(/No curated clinical context matched/);
  });

  it("includes clinician free text only on opt-in, and scrubbed", () => {
    const c = mkCase({ complaint: { chiefComplaintId: "sym_headache", freeText: "Mr Ramesh Kumar, ph 98765 43210, headache since morning", symptoms: [{ conceptId: "sym_headache", triggers: [], aggravating: [], relieving: [] }], associatedSymptomIds: [], redFlagChecks: [] } as never });
    const s = caseSpec(c, i);
    expect(buildPrompt(s)).not.toContain("headache since morning");
    const withText = buildPrompt(s, ALL_ON);
    expect(withText).toContain("headache since morning");
    expect(withText).not.toMatch(/Ramesh|98765/);
  });

  it("reference-page prompts carry the tool's recorded facts", () => {
    const d = i.drug.get("drug_ibuprofen")!;
    expect(buildPrompt(drugSpec(d, i))).toMatch(/Which of the tool's recorded facts below are inaccurate/);
    expect(buildPrompt(drugSpec(d, i))).toContain("Brufen");
    const h = i.kb.ayurvedicHerbs[0];
    expect(buildPrompt(herbSpec(h))).toContain(h.botanicalName);
    expect(buildPrompt(verificationSpec(i.kb.drugs))).toMatch(/curated-pending-verification/);
    const r = buildPrompt(repertorySpec([{ path: "Head, pain, sun", weight: 2 }], [{ abbrev: "Glon.", name: "Glonoinum", covered: 1, gradeSum: 3, weightedScore: 6 }]));
    expect(r).toContain("Head, pain, sun (weight ×2)");
    expect(r).toMatch(/not evidence of effectiveness/);
  });
});
