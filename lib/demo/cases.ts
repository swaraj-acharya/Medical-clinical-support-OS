/**
 * Demo cases — ENTIRELY FICTIONAL. No real patient data. Used by `npm run seed:demo`, the dashboard "load demo cases"
 * action and the integration tests.
 */
import type { CaseInputRaw } from "../validation/case-schema";

export interface DemoCase { key: string; title: string; purpose: string; input: CaseInputRaw }

const base = { history: { chronicConditions: [], surgeries: [], pastIllnesses: [], familyHistory: [] }, medications: [], vitals: {}, labs: {} };

export const DEMO_CASES: DemoCase[] = [
  {
    key: "homeopathy-headache",
    title: "Right-sided throbbing headache, worse sun and motion",
    purpose: "Homeopathic repertory workflow (also shows allopathic migraine-context matching side by side).",
    input: {
      ...base,
      patient: { patientRef: "DEMO-H01", ageYears: 35, sex: "male", pregnancyStatus: "not-applicable", breastfeeding: "not-applicable", allergies: [], renalImpairment: "none", hepaticImpairment: "none" },
      vitals: { temperatureC: 36.8, heartRate: 78, systolicBP: 124, diastolicBP: 80, respiratoryRate: 14, spo2: 98 },
      complaint: {
        chiefComplaintId: "sym_headache",
        freeText: "Right-sided throbbing headache since yesterday, worse in the sun and on moving, better with firm pressure; feels nauseous.",
        symptoms: [{ conceptId: "sym_headache", location: "temples", laterality: "right", sensation: "throbbing", severity: "moderate", onset: "gradual", durationValue: 1, durationUnit: "days", triggers: ["sun exposure"], aggravating: ["sun", "motion"], relieving: ["pressure"] }],
        associatedSymptomIds: ["sym_nausea"],
        redFlagChecks: [],
      },
      systems: ["allopathy", "ayurveda", "homeopathy"],
    },
  },
  {
    key: "allopathy-tension-headache",
    title: "Bilateral pressing headache (tension-type features)",
    purpose: "Allopathic guideline/context matching with safety filtering.",
    input: {
      ...base,
      patient: { patientRef: "DEMO-A01", ageYears: 28, sex: "female", pregnancyStatus: "not-pregnant", breastfeeding: "no", allergies: [], renalImpairment: "none", hepaticImpairment: "none" },
      vitals: { temperatureC: 36.7, heartRate: 72, systolicBP: 118, diastolicBP: 76 },
      complaint: {
        chiefComplaintId: "sym_headache",
        symptoms: [{ conceptId: "sym_headache", location: "forehead", laterality: "bilateral", sensation: "pressing, band-like", severity: "mild", onset: "gradual", durationValue: 2, durationUnit: "days", triggers: ["screen work"], aggravating: ["stress"], relieving: ["rest"] }],
        associatedSymptomIds: [],
        redFlagChecks: [],
      },
      systems: ["allopathy"],
    },
  },
  {
    key: "ayurveda-amlapitta",
    title: "Heartburn and sour regurgitation with observed Pitta vriddhi",
    purpose: "Ayurvedic context matching with dosha/agni/ama assessment.",
    input: {
      ...base,
      patient: { patientRef: "DEMO-Y01", ageYears: 42, sex: "male", pregnancyStatus: "not-applicable", breastfeeding: "not-applicable", allergies: [], renalImpairment: "none", hepaticImpairment: "none" },
      complaint: {
        chiefComplaintId: "sym_heartburn",
        symptoms: [
          { conceptId: "sym_heartburn", sensation: "burning", severity: "moderate", onset: "gradual", durationValue: 3, durationUnit: "weeks", triggers: ["spicy food"], aggravating: ["spicy food", "fasting"], relieving: ["cold milk"] },
          { conceptId: "sym_acid_regurgitation", severity: "mild", durationValue: 3, durationUnit: "weeks", triggers: [], aggravating: [], relieving: [] },
        ],
        associatedSymptomIds: ["sym_indigestion"],
        redFlagChecks: [],
      },
      ayurveda: { doshaObservations: ["pitta-vriddhi"], agni: "manda", ama: "present", assessmentNote: "Clinician impression: Amlapitta (demo)." },
      systems: ["ayurveda", "allopathy"],
    },
  },
  {
    key: "comparison-urti-fever",
    title: "Coryza, sore throat and fever — three systems compared",
    purpose: "Side-by-side comparison; shows dengue-risk rule and 'do not offer antibiotics' guidance.",
    input: {
      ...base,
      patient: { patientRef: "DEMO-C01", ageYears: 30, sex: "female", pregnancyStatus: "not-pregnant", breastfeeding: "no", allergies: [{ substance: "Amoxicillin", reaction: "urticaria", severity: "moderate" }], renalImpairment: "none", hepaticImpairment: "none" },
      vitals: { temperatureC: 38.2, heartRate: 92, respiratoryRate: 16, systolicBP: 116, diastolicBP: 74, spo2: 98 },
      complaint: {
        chiefComplaintId: "sym_runny_nose",
        symptoms: [
          { conceptId: "sym_runny_nose", severity: "moderate", onset: "gradual", durationValue: 2, durationUnit: "days", triggers: [], aggravating: ["cold air"], relieving: [] },
          { conceptId: "sym_sore_throat", severity: "mild", durationValue: 2, durationUnit: "days", triggers: [], aggravating: ["swallowing"], relieving: ["warm drinks"] },
          { conceptId: "sym_fever", severity: "mild", durationValue: 2, durationUnit: "days", triggers: [], aggravating: [], relieving: [] },
        ],
        associatedSymptomIds: ["sym_cough", "sym_sneezing"],
        redFlagChecks: [],
      },
      ayurveda: { doshaObservations: ["kapha-vriddhi"], agni: "not-assessed", ama: "not-assessed" },
      systems: ["allopathy", "ayurveda", "homeopathy"],
    },
  },
  {
    key: "redflag-thunderclap",
    title: "Sudden severe headache with neck stiffness",
    purpose: "Emergency red flag — candidate generation blocked.",
    input: {
      ...base,
      patient: { patientRef: "DEMO-R01", ageYears: 46, sex: "female", pregnancyStatus: "not-pregnant", breastfeeding: "no", allergies: [], renalImpairment: "none", hepaticImpairment: "none" },
      vitals: { temperatureC: 37.4, heartRate: 104, systolicBP: 150, diastolicBP: 92 },
      complaint: {
        chiefComplaintId: "sym_headache",
        symptoms: [{ conceptId: "sym_headache", location: "occiput", laterality: "bilateral", sensation: "bursting", severity: "severe", onset: "sudden", durationValue: 3, durationUnit: "hours", triggers: [], aggravating: [], relieving: [] }],
        associatedSymptomIds: ["sym_neck_stiffness", "sym_vomiting"],
        redFlagChecks: ["flag_thunderclap"],
      },
      systems: ["allopathy", "ayurveda", "homeopathy"],
    },
  },
  {
    key: "interaction-warfarin",
    title: "Tension-type headache in a patient taking warfarin",
    purpose: "Drug–drug interaction and duplicate-therapy filtering (warfarin + NSAIDs; Combiflam contains paracetamol).",
    input: {
      ...base,
      patient: { patientRef: "DEMO-I01", ageYears: 67, sex: "male", pregnancyStatus: "not-applicable", breastfeeding: "not-applicable", allergies: [], renalImpairment: "unknown", hepaticImpairment: "none" },
      history: { chronicConditions: ["cond_hypertension"], surgeries: [], pastIllnesses: [], familyHistory: [] },
      medications: [{ name: "Warfarin 5 mg OD" }, { name: "Amlodipine 5 mg" }, { name: "Combiflam" }],
      vitals: { temperatureC: 36.9, heartRate: 70, systolicBP: 136, diastolicBP: 84 },
      labs: { inr: 2.4 },
      complaint: {
        chiefComplaintId: "sym_headache",
        symptoms: [{ conceptId: "sym_headache", laterality: "bilateral", sensation: "pressing", severity: "mild", onset: "gradual", durationValue: 3, durationUnit: "days", triggers: [], aggravating: ["stress"], relieving: [] }],
        associatedSymptomIds: [],
        redFlagChecks: [],
      },
      systems: ["allopathy"],
    },
  },
  {
    key: "urgent-pregnancy-headache",
    title: "Headache at 26 weeks' gestation (urgent red flag, normal BP)",
    purpose: "Urgent red flag gating: candidates withheld until clinician acknowledgement.",
    input: {
      ...base,
      patient: { patientRef: "DEMO-P01", ageYears: 29, sex: "female", pregnancyStatus: "pregnant", gestationalWeeks: 26, breastfeeding: "no", allergies: [], renalImpairment: "none", hepaticImpairment: "none" },
      vitals: { temperatureC: 36.8, heartRate: 84, systolicBP: 122, diastolicBP: 78 },
      complaint: {
        chiefComplaintId: "sym_headache",
        symptoms: [{ conceptId: "sym_headache", laterality: "bilateral", sensation: "pressing", severity: "mild", onset: "gradual", durationValue: 1, durationUnit: "days", triggers: [], aggravating: [], relieving: ["rest"] }],
        associatedSymptomIds: [],
        redFlagChecks: [],
      },
      systems: ["allopathy", "ayurveda", "homeopathy"],
    },
  },
];
