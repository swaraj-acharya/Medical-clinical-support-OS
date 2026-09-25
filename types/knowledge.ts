import type { MedicalSystem, Provenanced, SourceRef, VerificationStatus } from "./provenance";

export type EvidenceCategory =
  | "authoritative-guideline"
  | "clinical-evidence"
  | "research-evidence"
  | "traditional-classical"
  | "repertory-reference"
  | "limited-evidence"
  | "conflicting-evidence"
  | "insufficient-evidence";

export interface TerminologyCode {
  system: "ICD-10" | "ICD-11" | "SNOMED-CT" | "RxNorm" | "NAMASTE" | "ATC" | "DOID" | "MeSH";
  code: string | null;
  display?: string;
  verification: VerificationStatus;
  note?: string;
}

export interface BodySystem { id: string; label: string; repertoryChapters: string[] }

export interface SymptomConcept extends Provenanced {
  id: string;
  label: string;
  bodySystem: string;
  synonyms: string[];
  /** Approximate Ayurvedic correlates (terminology bridge, NOT an equivalence claim). */
  ayurvedaTerms: string[];
  repertoryChapter?: string;
  codes: TerminologyCode[];
  /** Symptom is intrinsically a potential red flag when present. */
  redFlagConcept?: boolean;
}

export interface ClinicalContext extends Provenanced {
  id: string;
  label: string;
  description: string;
  codes: TerminologyCode[];
  /** Feature-based match criteria (ICHD-3 style). Each feature is a small predicate over the case. */
  features: ContextFeature[];
  minimumFeatures: number;
  excludeIfRedFlag: boolean;
  guidelineIds: string[];
  /** At least one of these symptom IDs must be present for the context to be considered at all. */
  requires: string[];
  /** Context-specific alarm features that route to referral/investigation before empirical therapy. */
  alarmFeatures: { id: string; when: RuleExpr; text: string; sources: SourceRef[] }[];
  notes?: string;
}

export interface ContextFeature {
  id: string;
  label: string;
  weight: 1 | 2 | 3;
  predicate: FeaturePredicate;
}

export type FeaturePredicate =
  | { kind: "symptom"; symptomId: string }
  | { kind: "detail"; symptomId: string; field: "laterality" | "sensation" | "severity" | "onset" | "location"; anyOf: string[] }
  | { kind: "aggravatedBy"; symptomId: string; anyOf: string[] }
  | { kind: "relievedBy"; symptomId: string; anyOf: string[] }
  | { kind: "notAggravatedBy"; symptomId: string; anyOf: string[] }
  | { kind: "absentSymptom"; symptomId: string }
  | { kind: "durationDaysAtMost"; symptomId: string; days: number }
  | { kind: "anySymptom"; symptomIds: string[] }
  | { kind: "allSymptoms"; symptomIds: string[] };

export interface ClinicalGuideline {
  id: string;
  title: string;
  issuer: string;
  jurisdiction: string;
  version: string;
  url: string;
  sourceId: string;
  verification: VerificationStatus;
  note?: string;
}

export interface GuidelineRecommendation extends Provenanced {
  id: string;
  guidelineId: string;
  contextId: string;
  kind: "offer" | "consider" | "do-not-offer";
  drugIds: string[];
  drugClass?: string;
  statement: string;
  conditionsForUse?: string;
}

export interface DrugIngredient { id: string; name: string; rxcui: string | null; strengthNote?: string }

export interface BrandMapping { brand: string; country: "IN" | "US" | "GB" | "INTL"; composition: string[]; verification: VerificationStatus; note?: string }

export interface Drug extends Provenanced {
  id: string;
  name: string;
  genericName: string;
  synonyms: string[];
  rxcui: string | null;
  classTags: string[];
  pharmacologicClass: string;
  composition: DrugIngredient[];
  doseForms: string[];
  routes: string[];
  brandMappings: BrandMapping[];
  whatItIs: string;
  whatItDoes: string;
  mechanism: string;
  usedFor: string[];
  contraindications: DrugRule[];
  warnings: DrugRule[];
  commonAdverseEffects: string[];
  seriousAdverseEffects: string[];
  boxedWarning?: string;
  labelUrl: string;
  dosingNote: string;
}

/** A patient-state rule for contraindication / warning evaluation. */
export interface DrugRule {
  id: string;
  text: string;
  severity: "contraindicated" | "avoid" | "caution" | "monitor";
  when: PatientTag[];
  source: SourceRef;
}

/** Normalized patient-state tags derived from the case (see lib/safety/patient-tags.ts). */
export type PatientTag = string;

export interface DrugInteraction extends Provenanced {
  id: string;
  a: string; // drug id or class:<tag>
  b: string;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  effect: string;
  management: string;
}

export interface AyurvedicHerb extends Provenanced {
  id: string;
  name: string;
  botanicalName: string;
  family: string;
  englishName: string;
  sanskritSynonyms: string[];
  partUsed: string[];
  mainIndications: string[];
  pacifies: string[];
  aggravates: string[];
  tridosha: boolean;
  rasa: string[];
  guna: string[];
  virya: string;
  vipaka: string;
  prabhava: string[];
  safetyNotes: SafetyNote[];
  modernEvidence: EvidenceNote[];
}

export interface AyurvedicFormulation extends Provenanced {
  id: string;
  name: string;
  formulationType: string;
  category: string;
  mainIngredients: string[];
  ingredientHerbIds: string[];
  ingredientsText: string;
  indicationsText: string;
  indicationTerms: string[];
  classicalReference: string;
  sourceReportedDose: string | null;
  anupana: string | null;
  containsMineralsOrMetals: boolean;
  safetyNotes: SafetyNote[];
  modernEvidence: EvidenceNote[];
}

export interface AyurvedicPrinciple extends Provenanced {
  id: string;
  name: string;
  category: string;
  shloka: string | null;
  shlokaRef: string | null;
  explanation: string;
  clinicalImportance: string | null;
}

export interface SafetyNote { id: string; text: string; level: "high-risk" | "warning" | "review" | "info"; source: SourceRef }
export interface EvidenceNote { category: EvidenceCategory; summary: string; source: SourceRef }

export interface HomeopathyRemedy {
  id: string; // "rem_<oorepId>"
  oorepId: number;
  abbrev: string;
  name: string;
  altNames: string[];
  toxicSource?: string;
}

export interface RepertoryRubric {
  id: string; // "pub_<oorepRubricId>"
  repertory: string;
  path: string;
  chapter: string;
  depth: number;
  parentPath: string | null;
}

export interface RubricRemedyRelation { rubricId: string; remedyId: string; grade: 1 | 2 | 3 }

export interface MateriaMedicaEntry {
  remedyId: string;
  source: string;
  sections: { heading: string; text: string }[];
}

export interface RedFlagRule {
  id: string;
  title: string;
  category: string;
  severity: "emergency" | "urgent";
  population: "all" | "adult" | "paediatric" | "pregnancy";
  when: RuleExpr;
  guidance: string;
  sources: SourceRef[];
  verification: VerificationStatus;
}

export type RuleExpr =
  | { all: RuleExpr[] }
  | { any: RuleExpr[] }
  | { symptom: string }
  | { flag: string }
  | { detail: { symptomId: string; field: "onset" | "severity" | "laterality" | "sensation"; anyOf: string[] } }
  | { vital: { name: "temperatureC" | "heartRate" | "respiratoryRate" | "systolicBP" | "diastolicBP" | "spo2" | "gcs"; op: "<" | "<=" | ">" | ">="; value: number } }
  | { ageYears: { op: "<" | "<=" | ">" | ">="; value: number } }
  | { pregnant: true }
  | { durationOver: { symptomId: string; days: number } }
  | { countAtLeast: { n: number; of: RuleExpr[] } };

export interface TerminologyMapping {
  id: string;
  input: string;
  conceptType: "symptom" | "context" | "drug" | "ayurveda-term";
  conceptId: string;
  language: "en" | "hi-Latn" | "sa-Latn";
  source: SourceRef;
}

export interface GraphEdge { from: string; rel: string; to: string; sourceId: string }

export interface KnowledgeMetadata {
  generatedAt: string;
  version: string;
  lastVerifiedAt: string;
  jurisdiction: string;
  purpose: string;
  contentHash: string;
  packs: { id: string; file: string; license: string; sourceId: string; counts: Record<string, number>; sha256: string }[];
  scopeNotes: string[];
}

export interface MasterKnowledge {
  metadata: KnowledgeMetadata;
  sources: { id: string; name: string; level: number; dataLicense: string }[];
  bodySystems: BodySystem[];
  symptoms: SymptomConcept[];
  conditions: ClinicalContext[];
  diseases: { id: string; label: string; codes: TerminologyCode[]; contextIds: string[] }[];
  drugs: Drug[];
  drugIngredients: DrugIngredient[];
  drugCompositions: { drugId: string; ingredientIds: string[] }[];
  drugClasses: { id: string; label: string; drugIds: string[] }[];
  /** Class membership lexicon for recognising current medications that are not full drug records (interaction/duplicate checks). */
  drugClassLexicon: DrugClassLexiconEntry[];
  drugIndications: { drugId: string; contextId: string; guidelineRecommendationId: string }[];
  contraindications: (DrugRule & { drugId: string })[];
  drugInteractions: DrugInteraction[];
  adverseEffects: { drugId: string; effect: string; seriousness: "common" | "serious" }[];
  warnings: (DrugRule & { drugId: string })[];
  clinicalGuidelines: ClinicalGuideline[];
  guidelineRecommendations: GuidelineRecommendation[];
  clinicalStudies: { id: string; title: string; citation: string; url: string; relevance: string; sourceId: string }[];
  allopathicKnowledge: { id: string; topic: string; text: string; sources: SourceRef[] }[];
  ayurvedicHerbs: AyurvedicHerb[];
  ayurvedicFormulations: AyurvedicFormulation[];
  ayurvedicPrinciples: AyurvedicPrinciple[];
  ayurvedicIndications: AyurvedaIndicationTerm[];
  ayurvedicRules: AyurvedaRules;
  ayurvedicSafety: AyurvedaSafety;
  ayurvedicReferences: { id: string; title: string; note: string }[];
  homeopathyRemedies: HomeopathyRemedy[];
  homeopathyRubrics: RepertoryRubric[];
  homeopathyRubricRemedyRelations: RubricRemedyRelation[];
  homeopathyMateriaMedica: { remedyId: string; source: string; headings: string[] }[];
  homeopathyEvidence: EvidenceNote[];
  homeopathyRegulatory: { text: string; source: SourceRef };
  homeopathyToxicSources: { abbrev: string; remedyId: string | null; material: string; note: string; sources: SourceRef[] }[];
  homeopathyRubricHints: RubricHints;
  homeopathyCaseTaking: { id: string; question: string; priority: "high" | "medium" | "low" }[];
  historyConditions: HistoryCondition[];
  redFlagChecklist: { id: string; label: string; appliesTo: string[] }[];
  redFlags: RedFlagRule[];
  terminologyMappings: TerminologyMapping[];
  graphEdges: GraphEdge[];
}

export interface DrugClassLexiconEntry extends Provenanced { classTag: string; label: string; members: string[] }

export interface HistoryCondition { id: string; label: string; tags: string[]; synonyms: string[] }

export interface AyurvedaIndicationTerm {
  term: string;
  label: string;
  variants: string[];
  symptomIds: string[];
  mappingType: "approximate-correlate";
  namasteCode: null;
  /** Optional qualifier: the term applies only when this symptom detail is present (e.g. Ardhavabhedaka = one-sided headache). */
  requiresDetail?: { symptomId: string; field: "laterality" | "sensation" | "location"; anyOf: string[] };
  note: string;
  source: SourceRef;
}

export interface AyurvedaRules {
  doshaSupport: Record<string, { pacifies: string; cautionIfAggravates: string; cautionVirya: string | null; principleIds: string[]; sources: SourceRef[]; text: string }>;
  agni: Record<string, { supportTerms?: string[]; cautionVirya?: string; principleIds: string[]; sources: SourceRef[]; text: string }>;
  ama: Record<string, { supportTerms: string[]; principleIds: string[]; sources: SourceRef[]; text: string }>;
}

export interface AyurvedaSafety {
  herbSafety: { herbId: string; note: SafetyNote; tagsHighRisk: string[] }[];
  generalSafety: {
    rasaushadhi: { id: string; text: string; source: SourceRef; highRiskTags: string[] };
    pregnancy: { id: string; text: string; source: SourceRef };
    herbDrug: { id: string; text: string; source: SourceRef; classTags: string[] };
    noModernEvidence: { text: string; source: SourceRef };
  };
}

export interface RubricHints {
  symptomRubrics: Record<string, string[]>;
  modifierRubrics: { symptomId: string; field: "laterality" | "sensation" | "location" | "aggravating" | "relieving" | "concomitant"; match: string[]; rubric: string }[];
}
