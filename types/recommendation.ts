import type { EvidenceCategory } from "./knowledge";
import type { MedicalSystem, SourceRef } from "./provenance";

export type SafetyLevel = "emergency" | "high-risk" | "warning" | "interaction" | "review" | "info";

export interface SafetyFinding {
  id: string;
  level: SafetyLevel;
  title: string;
  detail: string;
  ruleId?: string;
  matchedFacts?: string[];
  sources: SourceRef[];
}

export interface RedFlagResult {
  status: "clear" | "urgent" | "emergency";
  blocked: boolean;
  findings: SafetyFinding[];
  checkedRuleCount: number;
  note: string;
  missingVitals?: string[];
}

export interface WhyItem {
  kind: "match" | "context" | "guideline" | "safety-ok" | "safety-caution" | "source" | "traditional" | "repertory" | "evidence";
  text: string;
  sources?: SourceRef[];
}

export interface EvidenceLabel { category: EvidenceCategory; summary: string; source?: SourceRef }

interface CandidateBase {
  id: string;
  system: MedicalSystem;
  entityId: string;
  name: string;
  surfacedBecause: WhyItem[];
  safety: SafetyFinding[];
  safetyStatus: "no-conflict-in-entered-data" | "caution" | "excluded";
  evidence: EvidenceLabel[];
  sources: SourceRef[];
  lastVerified: string;
}

export interface AllopathyCandidate extends CandidateBase {
  system: "allopathy";
  metric: { label: "Guideline / clinical context match"; contextId: string; contextLabel: string; contextFeaturesMatched: string[]; contextFeaturesTotal: number; recommendationKind: "offer" | "consider" };
  guidelineStatement: string;
}

export interface AyurvedaCandidate extends CandidateBase {
  system: "ayurveda";
  kind: "herb" | "formulation";
  metric: { label: "Ayurvedic context match"; matchedTerms: string[]; doshaSupport: string[]; doshaCautions: string[] };
}

export interface HomeopathyCandidate extends CandidateBase {
  system: "homeopathy";
  abbrev: string;
  metric: { label: "Repertory match"; rubricsCovered: number; rubricsSelected: number; gradeSum: number; weightedScore: number; repertory: string };
  rubricGrades: { rubricId: string; path: string; grade: 0 | 1 | 2 | 3 }[];
  materiaMedica?: { source: string; headings: string[] };
}

export type Candidate = AllopathyCandidate | AyurvedaCandidate | HomeopathyCandidate;

export interface ContextFeatureStatus { id: string; label: string; weight: number; status: "met" | "not-met" | "unknown" }

export interface ContextMatch {
  contextId: string;
  label: string;
  description: string;
  matched: string[];
  total: number;
  /** Weighted share of features met (0..1) — a transparency measure of context fit, never a probability. */
  score: number;
  qualifies: boolean;
  minimumFeatures: number;
  features: ContextFeatureStatus[];
  alarms: { id: string; text: string; sources: SourceRef[] }[];
  guidelineIds: string[];
  codes: { system: string; code: string | null; display?: string }[];
  sources: SourceRef[];
}

export interface FollowUpQuestion {
  id: string;
  priority: "high" | "medium" | "low";
  purpose: "safety" | "diagnostic" | "characterisation" | "repertory" | "ayurveda" | "medication";
  question: string;
  reason: string;
  systems: (MedicalSystem | "shared")[];
}

export interface Advisory { kind: "alarm" | "do-not-offer" | "note" | "evidence" | "regulatory"; text: string; sources: SourceRef[] }

export interface SystemResult<C extends Candidate> {
  system: MedicalSystem;
  methodology: string;
  evidenceFraming: string;
  candidates: C[];
  excluded: { name: string; entityId: string; reason: string }[];
  advisories: Advisory[];
  notFound: string[];
  /** Homeopathy only: rubrics repertorized and where they came from. */
  rubricsUsed?: { rubricId: string; path: string; weight: number; origin: "clinician-selected" | "auto-suggested"; remedyCount: number; reason?: string }[];
}

export interface AnalysisResult {
  analysisId: string;
  caseId: string;
  createdAt: string;
  knowledgeBaseVersion: string;
  knowledgeContentHash: string;
  mode: "deterministic" | "deterministic+ai-extraction";
  redFlags: RedFlagResult;
  /** Candidate generation was withheld (emergency, or urgent without acknowledgement). */
  candidatesWithheld: boolean;
  withheldReason?: string;
  acknowledgement?: { ruleIds: string[]; clinicianRef: string; reason: string; at: string };
  normalizedSymptoms: { conceptId: string; label: string; role: "chief" | "presenting" | "associated"; bodySystem: string }[];
  medicationNormalization: { input: string; drugIds: string[]; classTags: string[]; via: string; note?: string }[];
  /** Interactions / duplications within the patient's current medicines (independent of any candidate). */
  regimenReview: SafetyFinding[];
  allergyNormalization: { substance: string; tags: string[]; recognised: boolean; note?: string }[];
  patientTags: string[];
  patientTagDerivations: string[];
  contexts: ContextMatch[];
  followUp: FollowUpQuestion[];
  allopathy?: SystemResult<AllopathyCandidate>;
  ayurveda?: SystemResult<AyurvedaCandidate>;
  homeopathy?: SystemResult<HomeopathyCandidate>;
  conflicts: { topic: string; detail: string; sources: SourceRef[] }[];
  sourcesUsed: string[];
}
