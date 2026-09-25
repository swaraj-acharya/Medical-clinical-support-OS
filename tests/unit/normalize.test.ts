import { describe, expect, it } from "vitest";
import { levenshtein, normalizeText, stem, toDays, trigramSimilarity } from "../../lib/normalize/text";
import { cleanMedicationName, resolveAllergy, resolveMedication } from "../../lib/normalize/medications";
import { idx } from "../helpers";

describe("text normalisation", () => {
  it("lower-cases, strips diacritics and punctuation", () => {
    expect(normalizeText("  Sir-Dard!! ")).toBe("sir dard");
    expect(normalizeText("Śirahśūla")).toBe("sirahsula");
  });
  it("stems simple plurals and -ing forms", () => {
    expect(stem("headaches")).toBe("headache");
    expect(stem("vomiting")).toBe("vomit");
    expect(stem("abdominal")).toBe("abdominal");
  });
  it("computes fuzzy similarity and bounded edit distance", () => {
    expect(trigramSimilarity("headache", "hedache")).toBeGreaterThan(0.4);
    expect(levenshtein("hedache", "headache")).toBe(1);
    expect(levenshtein("abc", "xyzxyz", 2)).toBe(3);
  });
  it("converts durations to days", () => {
    expect(toDays(2, "weeks")).toBe(14);
    expect(toDays(12, "hours")).toBe(0.5);
    expect(toDays(undefined, "days")).toBeUndefined();
  });
});

describe("symptom lexicon", () => {
  const i = idx();
  it("matches English, Hinglish and misspelt input with the match type reported", () => {
    expect(i.symptomLexicon.lookup("Headache")[0]).toMatchObject({ conceptId: "sym_headache", matchType: "exact" });
    expect(i.symptomLexicon.lookup("sar dard")[0]).toMatchObject({ conceptId: "sym_headache", matchType: "synonym" });
    expect(i.symptomLexicon.lookup("bukhar")[0].conceptId).toBe("sym_fever");
    const fz = i.symptomLexicon.lookup("hedache")[0];
    expect(fz.conceptId).toBe("sym_headache");
    expect(fz.matchType).toBe("fuzzy");
  });
  it("extracts several concepts from free text (deterministic mode)", () => {
    const ids = i.symptomLexicon.extract("Patient has sar dard and bukhar since 2 days, also nausea").map((m) => m.conceptId);
    expect(ids).toEqual(expect.arrayContaining(["sym_headache", "sym_fever", "sym_nausea"]));
  });
});

describe("medication and allergy normalisation", () => {
  const i = idx();
  it("strips strength and frequency", () => expect(cleanMedicationName("Pantoprazole 40 mg OD")).toBe("pantoprazole"));
  it("resolves generic names", () => {
    const r = resolveMedication("Warfarin 5 mg", i);
    expect(r.drugIds).toEqual(["drug_warfarin"]);
    expect(r.via).toBe("generic");
  });
  it("resolves an Indian fixed-dose combination brand to every ingredient", () => {
    const r = resolveMedication("Combiflam", i);
    expect(r.via).toBe("brand");
    expect(r.drugIds.sort()).toEqual(["drug_ibuprofen", "drug_paracetamol"]);
    expect(r.classTags).toContain("nsaid");
  });
  it("recognises class members held only in the class lexicon", () => {
    const r = resolveMedication("Diclofenac 50", i);
    expect(r.via).toBe("class-lexicon");
    expect(r.classTags).toContain("nsaid");
  });
  it("reports unrecognised medicines instead of guessing", () => {
    const r = resolveMedication("Zqxwv 10 mg", i);
    expect(r.via).toBe("unrecognised");
    expect(r.drugIds).toEqual([]);
  });
  it("turns allergies into class and ingredient tags", () => {
    expect(resolveAllergy("NSAIDs", i).tags).toContain("allergy:nsaid");
    expect(resolveAllergy("Penicillin", i).tags).toEqual(expect.arrayContaining(["allergy:penicillin", "allergy:beta-lactam"]));
    expect(resolveAllergy("unobtainium", i).recognised).toBe(false);
  });
});
