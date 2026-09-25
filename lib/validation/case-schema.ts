import { z } from "zod";

/** Identifiers are restricted to a safe charset (defends against path traversal / injection). */
export const idSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_.:-]+$/, "Invalid identifier");
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(4000);

export const SEX = ["female", "male", "intersex", "unknown"] as const;
export const PREGNANCY = ["not-applicable", "not-pregnant", "pregnant", "unknown"] as const;
export const IMPAIRMENT = ["none", "mild", "moderate", "severe", "unknown"] as const;
export const LATERALITY = ["left", "right", "bilateral", "alternating", "central", "not-applicable"] as const;
export const ONSET = ["sudden", "gradual", "unknown"] as const;
export const SEVERITY = ["mild", "moderate", "severe"] as const;
export const DURATION_UNIT = ["hours", "days", "weeks", "months", "years"] as const;
export const SYSTEMS = ["allopathy", "ayurveda", "homeopathy"] as const;
export const CLINICAL_ASSERTIONS = ["dengue-excluded"] as const;

export const allergySchema = z.object({
  substance: shortText.min(1),
  reaction: shortText.optional(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]).default("unknown"),
});

export const medicationSchema = z.object({
  name: shortText.min(1),
  drugId: idSchema.optional(),
  strength: shortText.optional(),
  frequency: shortText.optional(),
  duration: shortText.optional(),
});

export const symptomEntrySchema = z.object({
  conceptId: idSchema,
  location: shortText.optional(),
  laterality: z.enum(LATERALITY).optional(),
  sensation: shortText.optional(),
  severity: z.enum(SEVERITY).optional(),
  onset: z.enum(ONSET).optional(),
  durationValue: z.number().min(0).max(1000).optional(),
  durationUnit: z.enum(DURATION_UNIT).optional(),
  timing: shortText.optional(),
  triggers: z.array(shortText).max(20).default([]),
  aggravating: z.array(shortText).max(20).default([]),
  relieving: z.array(shortText).max(20).default([]),
});

export const vitalsSchema = z.object({
  temperatureC: z.number().min(25).max(45).optional(),
  heartRate: z.number().int().min(10).max(300).optional(),
  respiratoryRate: z.number().int().min(2).max(120).optional(),
  systolicBP: z.number().int().min(40).max(300).optional(),
  diastolicBP: z.number().int().min(20).max(200).optional(),
  spo2: z.number().int().min(40).max(100).optional(),
  gcs: z.number().int().min(3).max(15).optional(),
});

export const labsSchema = z.object({
  egfr: z.number().min(0).max(200).optional(),
  alt: z.number().min(0).max(10000).optional(),
  haemoglobin: z.number().min(1).max(25).optional(),
  platelets: z.number().min(0).max(2000).optional(),
  inr: z.number().min(0.5).max(15).optional(),
});

export const ayurvedaAssessmentSchema = z.object({
  doshaObservations: z.array(z.enum(["vata-vriddhi", "pitta-vriddhi", "kapha-vriddhi", "vata-kshaya", "pitta-kshaya", "kapha-kshaya"])).max(6).default([]),
  agni: z.enum(["sama", "vishama", "tikshna", "manda", "not-assessed"]).default("not-assessed"),
  ama: z.enum(["present", "absent", "not-assessed"]).default("not-assessed"),
  prakritiNote: shortText.optional(),
  assessmentNote: longText.optional(),
});

export const selectedRubricSchema = z.object({
  rubricId: idSchema,
  path: z.string().trim().max(400),
  weight: z.number().int().min(1).max(3).default(1),
});

export const caseInputSchema = z.object({
  patient: z.object({
    patientRef: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9-]+$/, "Use a pseudonymous reference (letters, digits, hyphens)"),
    ageYears: z.number().min(0).max(125),
    sex: z.enum(SEX),
    heightCm: z.number().min(20).max(260).optional(),
    weightKg: z.number().min(0.5).max(400).optional(),
    pregnancyStatus: z.enum(PREGNANCY).default("unknown"),
    gestationalWeeks: z.number().int().min(1).max(45).optional(),
    breastfeeding: z.enum(["yes", "no", "unknown", "not-applicable"]).default("unknown"),
    allergies: z.array(allergySchema).max(30).default([]),
    renalImpairment: z.enum(IMPAIRMENT).default("unknown"),
    hepaticImpairment: z.enum(IMPAIRMENT).default("unknown"),
  }),
  history: z.object({
    chronicConditions: z.array(idSchema).max(30).default([]),
    surgeries: z.array(shortText).max(30).default([]),
    pastIllnesses: z.array(shortText).max(30).default([]),
    familyHistory: z.array(shortText).max(30).default([]),
  }),
  medications: z.array(medicationSchema).max(40).default([]),
  vitals: vitalsSchema.default({}),
  labs: labsSchema.default({}),
  complaint: z.object({
    chiefComplaintId: idSchema,
    freeText: longText.optional(),
    symptoms: z.array(symptomEntrySchema).min(1).max(30),
    associatedSymptomIds: z.array(idSchema).max(30).default([]),
    redFlagChecks: z.array(idSchema).max(40).default([]),
  }),
  ayurveda: ayurvedaAssessmentSchema.optional(),
  homeopathy: z.object({ rubrics: z.array(selectedRubricSchema).max(40).default([]) }).optional(),
  /** Explicit clinician assertions that relax conservative default rules (each is audit-logged with the case). */
  clinicalAssertions: z.array(z.enum(CLINICAL_ASSERTIONS)).max(10).default([]),
  systems: z.array(z.enum(SYSTEMS)).min(1).default(["allopathy", "ayurveda", "homeopathy"]),
  caseNotes: longText.optional(),
});

export type CaseInput = z.infer<typeof caseInputSchema>;
export type CaseInputRaw = z.input<typeof caseInputSchema>;
export type SymptomEntry = z.infer<typeof symptomEntrySchema>;
export type SelectedRubric = z.infer<typeof selectedRubricSchema>;

export const decisionBaseSchema = z.object({
  candidateId: idSchema,
  system: z.enum(SYSTEMS),
  action: z.enum(["accepted", "rejected", "modified", "chose-alternative", "reviewed"]),
  alternative: shortText.optional(),
  reason: longText.optional(),
  clinicianRef: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9 ._-]+$/),
});
/** Rejections and alternatives must carry a reason (and the alternative chosen) for the audit record. */
export function decisionRules(d: { action: string; reason?: string; alternative?: string }, ctx: z.RefinementCtx) {
  if ((d.action === "rejected" || d.action === "chose-alternative") && !d.reason?.trim()) ctx.addIssue({ code: "custom", path: ["reason"], message: "A reason is required when rejecting or choosing an alternative" });
  if (d.action === "chose-alternative" && !d.alternative?.trim()) ctx.addIssue({ code: "custom", path: ["alternative"], message: "Name the alternative chosen" });
}
export const decisionSchema = decisionBaseSchema.superRefine(decisionRules);
export type DecisionInput = z.infer<typeof decisionSchema>;

export const acknowledgeSchema = z.object({
  acknowledgedRuleIds: z.array(idSchema).min(1).max(40),
  clinicianRef: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9 ._-]+$/),
  reason: longText.min(5),
});
