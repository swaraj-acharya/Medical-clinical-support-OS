import type { KnowledgeIndex } from "../knowledge/indexes";
import { resolveAllergy, resolveMedication, type ResolvedAllergy, type ResolvedMedication } from "../normalize/medications";
import { normalizeText, toDays } from "../normalize/text";
import type { CaseInput, SymptomEntry } from "../validation/case-schema";

export interface PatientState {
  tags: Set<string>;
  /** Human-readable derivations shown in the UI ("eGFR 25 → renal-severe"). */
  derivations: string[];
  symptomsPresent: Set<string>;
  symptomDetail: Map<string, SymptomEntry>;
  flags: Set<string>;
  meds: ResolvedMedication[];
  medDrugIds: Set<string>;
  medClassTags: Set<string>;
  medIngredients: Set<string>;
  allergies: ResolvedAllergy[];
  ageYears: number;
}

const IMPAIRMENT_ORDER = ["none", "mild", "moderate", "severe"] as const;
const worse = (a: string, b: string) => (IMPAIRMENT_ORDER.indexOf(a as never) >= IMPAIRMENT_ORDER.indexOf(b as never) ? a : b);

export function derivePatientState(c: CaseInput, idx: KnowledgeIndex): PatientState {
  const tags = new Set<string>(["any"]);
  const d: string[] = [];
  const age = c.patient.ageYears;
  const add = (tag: string, why: string) => { if (!tags.has(tag)) { tags.add(tag); d.push(`${why} → ${tag}`); } };

  if (age < 1) add("age-under-1", `Age ${age}`);
  if (age < 5) add("age-under-5", `Age ${age}`);
  if (age < 12) add("age-under-12", `Age ${age}`);
  if (age < 16) add("age-under-16", `Age ${age}`);
  if (age < 18) add("age-under-18", `Age ${age}`);
  if (age >= 55) add("age-55-plus", `Age ${age}`);
  if (age >= 65) add("age-65-plus", `Age ${age}`);

  const canBePregnant = c.patient.sex !== "male" && age >= 10 && age <= 55;
  if (canBePregnant) {
    if (c.patient.pregnancyStatus === "pregnant") {
      add("pregnant", "Pregnancy status: pregnant");
      if (c.patient.gestationalWeeks === undefined) add("pregnancy-weeks-unknown", "Gestational age not recorded");
      else if (c.patient.gestationalWeeks >= 20) add("pregnancy-20w-plus", `Gestation ${c.patient.gestationalWeeks} weeks`);
    } else if (c.patient.pregnancyStatus === "unknown") add("pregnancy-status-unknown", "Pregnancy status not recorded");
  }
  if (c.patient.breastfeeding === "yes") add("breastfeeding", "Breastfeeding");

  // Renal: worst of stated impairment and eGFR category.
  let renal: string = c.patient.renalImpairment === "unknown" ? "none" : c.patient.renalImpairment;
  const egfr = c.labs?.egfr;
  if (egfr !== undefined) renal = worse(renal, egfr < 30 ? "severe" : egfr < 60 ? "moderate" : egfr < 90 ? "mild" : "none");
  if (renal !== "none") add(`renal-${renal}`, egfr !== undefined ? `Renal impairment (stated ${c.patient.renalImpairment}, eGFR ${egfr})` : `Renal impairment stated ${renal}`);
  if (c.patient.hepaticImpairment !== "none" && c.patient.hepaticImpairment !== "unknown") add(`hepatic-${c.patient.hepaticImpairment}`, `Hepatic impairment stated ${c.patient.hepaticImpairment}`);

  for (const id of c.history.chronicConditions) {
    const hc = idx.historyCondition.get(id);
    if (hc) for (const t of hc.tags) add(t, hc.label);
  }
  if (c.labs?.platelets !== undefined && c.labs.platelets < 150) add("thrombocytopenia", `Platelets ${c.labs.platelets} ×10⁹/L`);

  const symptomsPresent = new Set<string>([...c.complaint.symptoms.map((s) => s.conceptId), ...c.complaint.associatedSymptomIds]);
  const symptomDetail = new Map(c.complaint.symptoms.map((s) => [s.conceptId, s]));
  const febrile = symptomsPresent.has("sym_fever") || (c.vitals?.temperatureC ?? 0) >= 38;
  if (febrile) {
    if (c.clinicalAssertions?.includes("dengue-excluded")) d.push("Fever present, clinician asserts dengue excluded → no dengue-risk tag");
    else add("dengue-risk", "Fever present (India-first rule: dengue not yet excluded)");
  }
  const sbp = c.vitals?.systolicBP;
  const dbp = c.vitals?.diastolicBP;
  if ((sbp ?? 0) >= 160 || (dbp ?? 0) >= 100) add("uncontrolled-hypertension", `BP ${sbp ?? "?"}/${dbp ?? "?"} mmHg (≥160/100 application rule)`);

  const meds = c.medications.map((m) => resolveMedication(m.name, idx, m.drugId));
  const medDrugIds = new Set(meds.flatMap((m) => m.drugIds));
  const medClassTags = new Set(meds.flatMap((m) => m.classTags));
  const medIngredients = new Set(meds.flatMap((m) => m.ingredients.map(normalizeText)));
  for (const t of medClassTags) tags.add(`on:${t}`);
  for (const id of medDrugIds) tags.add(`on:${id}`);

  const allergies = c.patient.allergies.map((a) => resolveAllergy(a.substance, idx));
  for (const a of allergies) for (const t of a.tags) tags.add(t);

  return { tags, derivations: d, symptomsPresent, symptomDetail, flags: new Set(c.complaint.redFlagChecks), meds, medDrugIds, medClassTags, medIngredients, allergies, ageYears: age };
}

export function symptomDurationDays(s: SymptomEntry | undefined): number | undefined {
  return s ? toDays(s.durationValue, s.durationUnit) : undefined;
}
