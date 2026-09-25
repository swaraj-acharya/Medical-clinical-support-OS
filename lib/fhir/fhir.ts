/**
 * FHIR R4 mapping (interoperability-ready, not a FHIR server). Case → Bundle for export; Bundle (e.g. Synthea output)
 * → partial case input for import. Symptom concepts use a local code system until SNOMED CT licensing is in place.
 */
import type { KnowledgeIndex } from "../knowledge/indexes";
import type { CaseInput, CaseInputRaw } from "../validation/case-schema";

const LOCAL = "urn:cds:concept";
const LOINC = "http://loinc.org";
const VITAL_LOINC: Record<string, [string, string, string]> = {
  temperatureC: ["8310-5", "Body temperature", "Cel"], heartRate: ["8867-4", "Heart rate", "/min"], respiratoryRate: ["9279-1", "Respiratory rate", "/min"],
  systolicBP: ["8480-6", "Systolic blood pressure", "mm[Hg]"], diastolicBP: ["8462-4", "Diastolic blood pressure", "mm[Hg]"],
  spo2: ["59408-5", "Oxygen saturation in Arterial blood by Pulse oximetry", "%"], gcs: ["9269-2", "Glasgow coma score total", "{score}"],
};

type Resource = Record<string, unknown> & { resourceType: string; id: string };

export function caseToFhirBundle(caseId: string, c: CaseInput, idx: KnowledgeIndex): Record<string, unknown> {
  const pid = `pat-${caseId}`;
  const subject = { reference: `Patient/${pid}` };
  const res: Resource[] = [
    { resourceType: "Patient", id: pid, identifier: [{ system: "urn:cds:pseudonym", value: c.patient.patientRef }], gender: c.patient.sex === "intersex" ? "other" : c.patient.sex,
      extension: [{ url: "urn:cds:age-years", valueDecimal: c.patient.ageYears }] },
    { resourceType: "Encounter", id: `enc-${caseId}`, status: "in-progress", class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB" }, subject },
  ];
  c.complaint.symptoms.forEach((s, i) => res.push({
    resourceType: "Condition", id: `cond-${i}`, subject, encounter: { reference: `Encounter/enc-${caseId}` },
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item" }] }],
    code: { coding: [{ system: LOCAL, code: s.conceptId, display: idx.symptom.get(s.conceptId)?.label }], text: idx.symptom.get(s.conceptId)?.label },
    severity: s.severity ? { text: s.severity } : undefined,
    note: [s.location, s.laterality, s.sensation].filter(Boolean).length ? [{ text: [s.location, s.laterality, s.sensation].filter(Boolean).join("; ") }] : undefined,
  }));
  for (const [k, v] of Object.entries(c.vitals ?? {})) {
    const m = VITAL_LOINC[k];
    if (m && typeof v === "number") res.push({ resourceType: "Observation", id: `obs-${k}`, status: "final", subject, category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
      code: { coding: [{ system: LOINC, code: m[0], display: m[1] }] }, valueQuantity: { value: v, unit: m[2], system: "http://unitsofmeasure.org", code: m[2] } });
  }
  c.patient.allergies.forEach((a, i) => res.push({ resourceType: "AllergyIntolerance", id: `alg-${i}`, patient: subject, code: { text: a.substance }, reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined }));
  c.medications.forEach((m, i) => res.push({ resourceType: "MedicationStatement", id: `med-${i}`, status: "active", subject, medicationCodeableConcept: { text: m.name } }));
  return { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), entry: res.map((r) => ({ fullUrl: `urn:uuid:${r.id}`, resource: JSON.parse(JSON.stringify(r)) })) };
}

/** Maps a FHIR Bundle (Synthea-style) to a draft case. Unmapped conditions are returned for clinician review, never guessed. */
export function fhirBundleToCaseDraft(bundle: unknown, idx: KnowledgeIndex, now = new Date()): { draft: Partial<CaseInputRaw>; unmapped: string[] } {
  const entries = ((bundle as { entry?: { resource?: Record<string, any> }[] })?.entry ?? []).map((e) => e.resource).filter(Boolean) as Record<string, any>[];
  const unmapped: string[] = [];
  const patient = entries.find((r) => r.resourceType === "Patient");
  let age = 0;
  if (patient?.birthDate) age = Math.max(0, Math.floor((now.getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 864e5)));
  const sex = patient?.gender === "female" || patient?.gender === "male" ? patient.gender : "unknown";
  const symptoms: string[] = [];
  for (const r of entries.filter((x) => x.resourceType === "Condition" || (x.resourceType === "Observation" && x.category?.[0]?.coding?.[0]?.code !== "vital-signs"))) {
    const text: string = r.code?.text ?? r.code?.coding?.[0]?.display ?? "";
    if (!text) continue;
    const hit = idx.symptomLexicon.lookup(text.replace(/\((finding|disorder|situation)\)/gi, ""), { limit: 1 })[0];
    if (hit && hit.score >= 0.9) symptoms.push(hit.conceptId);
    else unmapped.push(text);
  }
  const vitals: Record<string, number> = {};
  for (const r of entries.filter((x) => x.resourceType === "Observation")) {
    const code = r.code?.coding?.find((c: any) => c.system === LOINC)?.code;
    const k = Object.entries(VITAL_LOINC).find(([, v]) => v[0] === code)?.[0];
    if (k && typeof r.valueQuantity?.value === "number") vitals[k] = r.valueQuantity.value;
  }
  const meds = entries.filter((r) => r.resourceType === "MedicationRequest" || r.resourceType === "MedicationStatement")
    .map((r) => r.medicationCodeableConcept?.text ?? r.medicationCodeableConcept?.coding?.[0]?.display).filter(Boolean).map((name: string) => ({ name }));
  const allergies = entries.filter((r) => r.resourceType === "AllergyIntolerance").map((r) => ({ substance: r.code?.text ?? r.code?.coding?.[0]?.display ?? "unknown", severity: "unknown" as const }));
  const uniq = [...new Set(symptoms)];
  return {
    draft: {
      patient: { patientRef: `FHIR-${String(patient?.id ?? "import").replace(/[^A-Za-z0-9-]/g, "").slice(0, 20) || "IMPORT"}`, ageYears: age, sex, allergies, pregnancyStatus: "unknown", breastfeeding: "unknown", renalImpairment: "unknown", hepaticImpairment: "unknown" },
      medications: meds,
      vitals,
      complaint: uniq.length ? { chiefComplaintId: uniq[0], symptoms: uniq.map((conceptId) => ({ conceptId, triggers: [], aggravating: [], relieving: [] })), associatedSymptomIds: [], redFlagChecks: [] } : undefined,
    },
    unmapped,
  };
}
