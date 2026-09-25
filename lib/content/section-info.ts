/**
 * "About this section" text for every page and section. One place, so wording stays consistent and reviewable by the
 * clinical-governance group. Plain strings only (client-safe).
 */
export interface SectionInfo {
  /** What the section shows. */
  what: string;
  /** How it is produced. */
  how?: string;
  /** Which data it uses. */
  data?: string;
  /** Limits the clinician must keep in mind. */
  limits?: string;
}

const PROMPT_NOTE = "Use “Research prompt” to generate a ready-to-copy prompt for any AI or deep-research tool. It contains this section's data (de-identified) and asks for guideline and research-paper evidence with verifiable citations.";

export const INFO = {
  // ---------------------------------------------------------------- pages
  dashboard: {
    what: "Your starting point: recent cases with their latest safety-screen result, and a summary of what the knowledge base holds for each system.",
    data: "Cases stored on this server; counts from the loaded knowledge-base version.",
    limits: "Counts describe coverage, not quality. Facts marked “pending verification” must be checked before clinical use.",
  },
  kbSummary: {
    what: "How much each system's knowledge base holds in this version.",
    limits: "Allopathy is a curated seed (6 clinical contexts); Ayurveda and homeopathy are imported open datasets. Anything outside them can be researched with the prompts in each section.",
  },
  cases: {
    what: "All stored cases with pseudonymous references, requested systems, number of analyses and decisions, and the latest safety-screen status.",
    how: "Each analysis is stored separately with the knowledge-base version used, so earlier results remain reproducible.",
    limits: "Stored locally on this server. Use pseudonymous references only.",
  },
  caseDetail: {
    what: "Everything recorded for one case: the entered data, every analysis run, clinician decisions and the audit trail.",
    how: "Re-running an analysis never overwrites an earlier one. The audit trail is hash-chained so any edit to the log is detectable.",
    limits: `The FHIR export is for interoperability testing; symptom codes use a local code system until SNOMED CT is licensed. ${PROMPT_NOTE}`,
  },
  caseData: { what: "The data exactly as entered for this case. Analyses use only this data — nothing is inferred about fields left blank." },
  caseAnalyses: { what: "Every analysis run on this case, newest first, with the knowledge-base version, safety status and number of candidates per system." },
  caseDecisions: { what: "Decisions the clinician recorded on candidates (reviewed, accepted, modified, rejected or alternative chosen), with reasons and clinician reference." },
  caseAudit: {
    what: "Audit entries for this case: creation, analyses, red-flag acknowledgements and decisions.",
    how: "Each entry stores the SHA-256 hash of the previous entry. “Intact” means no entry has been altered, removed or reordered.",
  },
  newCase: {
    what: "An eight-step form to record a case. Only the patient details, one presenting symptom and at least one system are required.",
    how: "On saving, the safety screen runs first; then each selected system runs separately. You are taken straight to the analysis.",
    limits: "Never enter names, phone numbers, Aadhaar numbers or other identifiers — use a pseudonymous reference.",
  },
  recommendations: {
    what: "The latest analysis of every case in one list: candidates per system, their safety status and whether a decision has been recorded.",
    limits: "Candidates are suggestions for clinician review, not prescriptions. Open the analysis for reasons, safety findings and sources.",
  },
  medicines: {
    what: "Reference lists for allopathic medicines, Ayurvedic herbs and formulations, and homeopathic remedies.",
    how: "Filtering matches names, synonyms and brands. Open an entry for “What does this medicine do?”, safety information and sources.",
    limits: `If a medicine is not listed, it is not in this knowledge base — use the research prompt to look it up elsewhere. ${PROMPT_NOTE}`,
  },
  medicineDrug: {
    what: "What the medicine is, what it does, how it works, what it is used for, contraindications, warnings, adverse effects, interactions, brands and guideline links.",
    data: "Hand-curated paraphrases of label content with sources; verification status is shown next to the title.",
    limits: `No doses are given here. Check the current label/formulary before prescribing. ${PROMPT_NOTE}`,
  },
  medicineHerb: {
    what: "Classical Dravyaguna profile of the herb (rasa, guna, virya, vipaka, prabhava, dosha action), recorded indications, safety notes and formulations that contain it.",
    data: "Amidha Ayurveda open dataset (CC BY 4.0) plus curated safety notes (e.g., LiverTox).",
    limits: `Traditional properties and indications are not evidence of clinical efficacy. ${PROMPT_NOTE}`,
  },
  medicineFormulation: {
    what: "Classical formulation: type, category, ingredients, indications as stated in the source, the source-reported dose and anupana, and safety notes.",
    data: "Bhaishajya Kalpana Kosha dataset (CC BY 4.0) plus curated Rasaushadhi and ingredient-level safety notes.",
    limits: `Doses are shown as source statements only. Mineral/metal (Rasaushadhi) preparations are always flagged. ${PROMPT_NOTE}`,
  },
  medicineRemedy: {
    what: "Homeopathic remedy: source-material warnings, the Boericke (1906) materia medica chapter, and the evidence and regulatory position.",
    limits: `Materia medica is a historical, traditional text; it is not evidence of effect. ${PROMPT_NOTE}`,
  },
  repertory: {
    what: "The full Repertorium Publicum: browse chapter → rubric → sub-rubric, search, add rubrics with weights and repertorize.",
    how: "Repertorization ranks remedies by how many selected rubrics list them (coverage), then by the weighted sum of their grades (1–3).",
    limits: `A repertory cross-reference, not a probability of benefit. After repertorizing, a research prompt compares the top remedies. ${PROMPT_NOTE}`,
  },
  ayurvedaExplorer: {
    what: "Browse herbs (with rasa, virya, vipaka and dosha filters), formulations, principles (siddhanta) and the symptom-to-classical-term bridges used by the Ayurveda engine.",
    data: "Amidha Ayurveda open datasets (CC BY 4.0).",
    limits: `Bridges are approximate correlates, not NAMASTE codes. Search a term to get a research prompt for it. ${PROMPT_NOTE}`,
  },
  sources: {
    what: "Every source registered in the knowledge base with its authority level, licence, commercial-use and redistribution terms, how it is used and when it was last checked.",
    how: "Level 1 (official/regulatory/guideline) is most authoritative; lower levels never override higher-level safety information.",
  },
  admin: {
    what: "Health of the knowledge base (validation errors and warnings, provenance coverage, data packs), integrity of the audit log, and the complete red-flag rule set.",
    how: "Validation runs at build time (npm run knowledge:build / knowledge:validate). “Reload” re-reads the knowledge files without restarting.",
    limits: "Use the verification research prompt to check the curated drug facts that are still pending verification.",
  },
  settings: {
    what: "Current configuration read from environment variables: access control, analysis mode, AI extraction and storage.",
    limits: "Change settings in .env.local (development) or the server environment, then restart. Secrets are never shown.",
  },
  search: {
    what: "Searches symptoms (English, Hinglish, Ayurvedic terms), medicines and brands, herbs, formulations, principles, remedies, rubrics, clinical contexts, guidelines, red-flag rules and sources.",
    how: "Each result shows how it matched: exact, synonym (including brands and variant spellings), normalised, or fuzzy (possible misspelling — confirm).",
    limits: `If what you need is not found, generate a research prompt for the term. ${PROMPT_NOTE}`,
  },
  // ---------------------------------------------------------------- analysis sections
  analysisGate: {
    what: "The safety screen. It runs before any system and decides whether candidates can be shown.",
    how: "Emergency red flag → no candidates at all (cannot be overridden). Urgent red flag → candidates withheld until a clinician records an assessment, which is audit-logged. Clear → no rule matched.",
    limits: `“Clear” is not reassurance: rules not fully evaluable because of missing vitals are listed, and the rule set is limited. ${PROMPT_NOTE}`,
  },
  patientSummary: {
    what: "How the tool understood the case: normalised symptoms, recognised medicines and allergies, derived patient-safety tags, and a review of the current regimen.",
    how: "Brands and fixed-dose combinations are resolved to ingredients; age, pregnancy, organ function and conditions become tags that drive contraindication rules.",
    limits: `Unrecognised medicines or allergies are not checked — the research prompt asks an AI tool to identify them. ${PROMPT_NOTE}`,
  },
  clinicalContext: {
    what: "Curated clinical contexts (for example ICHD-3-style migraine or tension-type features) compared with the case, feature by feature.",
    how: "A context is met when enough features are present. The percentage is the weighted share of features met — a transparency measure, not a probability of disease.",
    limits: `Only a small set of contexts is curated. If none matches, the condition is not in the knowledge base — use the research prompt for a differential diagnosis. ${PROMPT_NOTE}`,
  },
  followUp: {
    what: "Questions and checks that would make the analysis safer or more specific, highest priority first.",
    how: "Generated from unticked red-flag items, missing vitals, unknown pregnancy or organ status, unrecognised medicines, unknown context features and system-specific case-taking items.",
    limits: PROMPT_NOTE,
  },
  allopathy: {
    what: "Conventional medicines linked to guideline recommendations for the matched clinical context, after safety filtering.",
    how: "Context → guideline recommendation → candidate medicine → allergy, contraindication, interaction, duplicate-therapy and pregnancy checks. Excluded medicines are listed with reasons.",
    limits: `No dosing. Most drug facts are curated seeds pending verification. Options outside the knowledge base are not shown — the research prompt asks for them. ${PROMPT_NOTE}`,
  },
  ayurveda: {
    what: "Herbs and formulations whose classical indications match the case, marked as supporting or needing review according to the clinician's dosha, agni and ama assessment.",
    how: "Symptoms are bridged to classical terms, then matched against recorded indications and karma; safety rules add Rasaushadhi, herb-specific and herb–drug warnings.",
    limits: `Traditional rationale is shown separately from modern evidence, which is usually absent from the dataset. ${PROMPT_NOTE}`,
  },
  homeopathy: {
    what: "Remedies from repertorization of the selected (or provisionally auto-suggested) rubrics, with materia medica links and safety notes.",
    how: "Ranked by rubric coverage, then weighted grade sum. Auto-suggested rubrics are labelled; choose your own in the repertory selector for a proper analysis.",
    limits: `A repertory match is not a probability or evidence of effectiveness; the NHMRC evidence position is shown alongside. ${PROMPT_NOTE}`,
  },
  comparison: {
    what: "The top candidates of each requested system side by side.",
    limits: `Each system uses a different method, so their rankings are not comparable. Check cross-system interactions. ${PROMPT_NOTE}`,
  },
  conflicts: {
    what: "Places where sources disagree, and every source used in this analysis with its authority level and licence.",
    how: "Conflicts are displayed, never silently resolved.",
    limits: PROMPT_NOTE,
  },
  decisions: {
    what: "The clinician's decisions on candidates in this analysis. Each is stored with the analysis ID and knowledge-base version and written to the audit log.",
    limits: `The research prompt here asks for a critical appraisal of the documented plan against guidelines. ${PROMPT_NOTE}`,
  },
  // ---------------------------------------------------------------- new-case steps
  stepPatient: { what: "Who the patient is (pseudonymously): age, sex, pregnancy and breastfeeding status, height and weight.", limits: "Age and pregnancy status drive many safety rules. “Unknown” pregnancy status creates a follow-up question." },
  stepSafety: { what: "Allergies, kidney and liver function, chronic conditions and clinical assertions (for example, dengue excluded).", limits: "These become safety tags used by every system. Missing information limits the checks — it is never assumed normal." },
  stepMedicines: { what: "Medicines the patient currently takes. Generic names, Indian brands and fixed-dose combinations are accepted.", limits: "Anything not recognised is reported in the analysis, where a research prompt can identify it." },
  stepComplaint: { what: "Presenting symptoms and their characteristics: site, side, character, severity, onset, duration, modalities and triggers.", how: "Symptom search understands English, Hinglish and Ayurvedic terms. “Suggest symptoms from text” uses lexicon matching (Deterministic Mode).", limits: "If a symptom is not in the list, generate a research prompt for it and record it in the case notes." },
  stepRedFlags: { what: "Associated symptoms and the red-flag checklist relevant to what you have entered.", limits: "Tick only what is present. The safety engine runs first and can block candidate generation." },
  stepVitals: { what: "Vital signs and key laboratory values.", limits: "Rules that need a missing value are reported as not fully evaluable." },
  stepSystems: { what: "Which systems to consult, the clinician's Ayurvedic assessment (dosha, agni, ama) and repertory rubrics.", limits: "The Ayurvedic assessment is a traditional clinical judgement, not a validated diagnostic test. Rubrics left empty are auto-suggested and labelled provisional." },
  stepReview: { what: "Check the summary, add optional notes, then save and analyse.", limits: "Case notes are free text: do not include identifiers. They are excluded from research prompts unless you opt in." },
} satisfies Record<string, SectionInfo>;

export type InfoKey = keyof typeof INFO;
