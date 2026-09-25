import { buildIndex, type KnowledgeIndex } from "../lib/knowledge/indexes";
import { getKnowledge } from "../lib/knowledge/store";
import { derivePatientState, type PatientState } from "../lib/safety/patient-state";
import { caseInputSchema, type CaseInput, type CaseInputRaw } from "../lib/validation/case-schema";

export const idx = (): KnowledgeIndex => buildIndex(getKnowledge());

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

/** Builds a validated case. Defaults: 35-year-old woman, not pregnant, headache (bilateral, pressing, mild, 2 days). */
export function mkCase(o: DeepPartial<CaseInputRaw> = {}): CaseInput {
  const raw: CaseInputRaw = {
    patient: { patientRef: "TEST-1", ageYears: 35, sex: "female", pregnancyStatus: "not-pregnant", breastfeeding: "no", allergies: [], renalImpairment: "none", hepaticImpairment: "none", ...(o.patient as object) } as CaseInputRaw["patient"],
    history: { chronicConditions: [], surgeries: [], pastIllnesses: [], familyHistory: [], ...(o.history as object) },
    medications: o.medications ?? [],
    vitals: (o.vitals as CaseInputRaw["vitals"]) ?? { temperatureC: 36.8, heartRate: 76, respiratoryRate: 14, systolicBP: 120, diastolicBP: 78, spo2: 98, gcs: 15 },
    labs: (o.labs as CaseInputRaw["labs"]) ?? {},
    complaint: {
      chiefComplaintId: "sym_headache",
      symptoms: [{ conceptId: "sym_headache", laterality: "bilateral", sensation: "pressing", severity: "mild", onset: "gradual", durationValue: 2, durationUnit: "days", triggers: [], aggravating: [], relieving: [] }],
      associatedSymptomIds: [], redFlagChecks: [],
      ...(o.complaint as object),
    } as CaseInputRaw["complaint"],
    ayurveda: o.ayurveda as CaseInputRaw["ayurveda"],
    homeopathy: o.homeopathy as CaseInputRaw["homeopathy"],
    clinicalAssertions: o.clinicalAssertions ?? [],
    systems: o.systems ?? ["allopathy", "ayurveda", "homeopathy"],
  };
  return caseInputSchema.parse(raw);
}

export const stateOf = (c: CaseInput, i = idx()): PatientState => derivePatientState(c, i);
