/**
 * Builds a PromptSpec for each section from the data that section already holds. Pure: only type imports from the
 * knowledge layer, so termSpec / repertorySpec can also run in client components.
 */
import type { AyurvedicFormulation, AyurvedicHerb, Drug, HomeopathyRemedy } from "../../types/knowledge";
import type { AnalysisResult, Candidate, SystemResult } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { scrubIdentifiers } from "../security/scrub";
import type { CaseInput } from "../validation/case-schema";
import { pubmedQuery, SOURCES, type PromptSpec } from "./build";

const TEN_YEARS_AGO = () => new Date().getFullYear() - 10;
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ shared case snapshot

/** English search terms for a symptom concept (label + curated English synonyms). */
export function symptomTerms(idx: KnowledgeIndex, id: string, max = 3): string[] {
  const s = idx.symptom.get(id);
  if (!s) return [];
  const en = idx.kb.terminologyMappings.filter((m) => m.conceptType === "symptom" && m.conceptId === id && m.language === "en").map((m) => m.input);
  return uniq([s.label.replace(/\s*\/.*$/, "").toLowerCase(), ...en]).filter((t) => t.length > 2 && !/[()]/.test(t)).slice(0, max);
}

function drugTerms(d: Drug): string[] {
  return uniq([...d.composition.map((c) => c.name.toLowerCase()), ...d.synonyms.filter((x) => /^[a-z -]+$/i.test(x)).map((x) => x.toLowerCase())]).slice(0, 3);
}

const VITALS: [keyof NonNullable<CaseInput["vitals"]>, string, string][] = [
  ["temperatureC", "Temperature", " °C"], ["heartRate", "Heart rate", "/min"], ["respiratoryRate", "Respiratory rate", "/min"],
  ["systolicBP", "Systolic BP", " mmHg"], ["diastolicBP", "Diastolic BP", " mmHg"], ["spo2", "SpO₂", "%"], ["gcs", "GCS", ""],
];
const LABS: [keyof NonNullable<CaseInput["labs"]>, string, string][] = [
  ["egfr", "eGFR", " mL/min/1.73m²"], ["alt", "ALT", " U/L"], ["haemoglobin", "Haemoglobin", " g/dL"], ["platelets", "Platelets", " ×10⁹/L"], ["inr", "INR", ""],
];

/** De-identified patient snapshot. Never includes the patient reference or any free text. */
export function caseSnapshot(c: CaseInput, idx: KnowledgeIndex): string[] {
  const p = c.patient;
  const L: string[] = [];
  const label = (id: string) => idx.symptom.get(id)?.label ?? id;
  L.push("## Patient");
  L.push(`Age ${p.ageYears} years; sex ${p.sex}`);
  if (p.sex !== "male") L.push(`Pregnancy: ${p.pregnancyStatus.replace(/-/g, " ")}${p.pregnancyStatus === "pregnant" && p.gestationalWeeks !== undefined ? ` (${p.gestationalWeeks} weeks)` : ""}; breastfeeding: ${p.breastfeeding.replace(/-/g, " ")}`);
  if (p.weightKg || p.heightCm) L.push([p.weightKg ? `Weight ${p.weightKg} kg` : "", p.heightCm ? `height ${p.heightCm} cm` : ""].filter(Boolean).join("; "));
  L.push(`Renal impairment: ${p.renalImpairment}; hepatic impairment: ${p.hepaticImpairment}`);
  const conds = c.history.chronicConditions.map((id) => idx.historyCondition.get(id)?.label ?? id);
  L.push(`Chronic conditions: ${conds.length ? conds.join(", ") : "none recorded"}`);
  L.push(`Allergies/intolerances: ${p.allergies.length ? p.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction}${a.severity !== "unknown" ? `, ${a.severity}` : ""})` : ""}`).join("; ") : "none recorded"}`);
  L.push(`Current medicines: ${c.medications.length ? c.medications.map((m) => [m.name, m.strength, m.frequency].filter(Boolean).join(" ")).join("; ") : "none recorded"}`);
  if (c.clinicalAssertions?.includes("dengue-excluded")) L.push("Clinician asserts: dengue has been excluded");

  L.push("## Presentation");
  for (const s of c.complaint.symptoms) {
    const bits = [s.location, s.laterality, s.sensation, s.severity, s.onset ? `${s.onset} onset` : "", s.durationValue ? `${s.durationValue} ${s.durationUnit ?? ""}`.trim() : ""].filter(Boolean);
    const mods = [s.aggravating.length ? `worse: ${s.aggravating.join(", ")}` : "", s.relieving.length ? `better: ${s.relieving.join(", ")}` : "", s.triggers.length ? `triggers: ${s.triggers.join(", ")}` : ""].filter(Boolean);
    L.push(`${label(s.conceptId)}${s.conceptId === c.complaint.chiefComplaintId ? " (chief complaint)" : ""}${bits.length ? ` — ${bits.join(", ")}` : ""}${mods.length ? `; ${mods.join("; ")}` : ""}`);
  }
  L.push(`Associated symptoms: ${c.complaint.associatedSymptomIds.length ? c.complaint.associatedSymptomIds.map(label).join(", ") : "none recorded"}`);
  const flags = c.complaint.redFlagChecks.map((f) => idx.kb.redFlagChecklist.find((x) => x.id === f)?.label ?? f);
  L.push(`Red-flag checklist items present: ${flags.length ? flags.join("; ") : "none ticked"}`);

  L.push("## Observations");
  const v = VITALS.filter(([k]) => c.vitals?.[k] !== undefined);
  const missing = VITALS.filter(([k]) => c.vitals?.[k] === undefined).map(([, n]) => n);
  L.push(`Vitals: ${v.length ? v.map(([k, n, u]) => `${n} ${c.vitals![k]}${u}`).join("; ") : "none recorded"}${missing.length && v.length ? ` (not recorded: ${missing.join(", ")})` : ""}`);
  const l = LABS.filter(([k]) => c.labs?.[k] !== undefined);
  if (l.length) L.push(`Labs: ${l.map(([k, n, u]) => `${n} ${c.labs![k]}${u}`).join("; ")}`);

  if (c.systems.includes("ayurveda") && c.ayurveda) {
    L.push("## Ayurvedic assessment (clinician's)");
    L.push(`Dosha observations: ${c.ayurveda.doshaObservations.join(", ") || "not recorded"}; agni: ${c.ayurveda.agni}; ama: ${c.ayurveda.ama}`);
  }
  if (c.systems.includes("homeopathy") && c.homeopathy?.rubrics.length) {
    L.push("## Repertory rubrics chosen by the clinician (Repertorium Publicum)");
    for (const r of c.homeopathy.rubrics) L.push(`${r.path}${r.weight > 1 ? ` (weight ×${r.weight})` : ""}`);
  }
  L.push("## Request");
  L.push(`Systems the clinician wants considered: ${c.systems.join(", ")}`);
  return L;
}

/** Free text entered by the clinician, scrubbed. Included in prompts only when the clinician opts in. */
export function caseFreeText(c: CaseInput): string | undefined {
  const parts = [c.complaint.freeText, c.ayurveda?.prakritiNote ? `Prakriti note: ${c.ayurveda.prakritiNote}` : "", c.ayurveda?.assessmentNote ? `Ayurvedic assessment note: ${c.ayurveda.assessmentNote}` : "", c.caseNotes ? `Case notes: ${c.caseNotes}` : ""].filter(Boolean) as string[];
  return parts.length ? scrubIdentifiers(parts.join("\n")).slice(0, 3000) : undefined;
}

// ------------------------------------------------------------------ analysis sections

export type AnalysisSectionKey = "redFlags" | "patientSummary" | "clinicalContext" | "followUp" | "allopathy" | "ayurveda" | "homeopathy" | "comparison" | "conflicts" | "decisions";

export interface DecisionLite { action: string; candidateName: string; system: string; alternative?: string; reason?: string }

function candidateLine(c: Candidate): string {
  const cautions = c.safety.filter((f) => f.level !== "info").map((f) => f.title);
  if (c.system === "allopathy") return `${c.name} — ${c.metric.recommendationKind} for ${c.metric.contextLabel}; safety: ${c.safetyStatus}${cautions.length ? ` (${cautions.join("; ")})` : ""}`;
  if (c.system === "ayurveda") return `${c.name} [${c.kind}] — classical indication matched: ${c.metric.matchedTerms.join(", ")}; safety: ${c.safetyStatus}${cautions.length ? ` (${cautions.join("; ")})` : ""}`;
  return `${c.name} (${c.abbrev}) — covers ${c.metric.rubricsCovered}/${c.metric.rubricsSelected} rubrics, grade sum ${c.metric.gradeSum}${cautions.length ? `; ${cautions.join("; ")}` : ""}`;
}

function systemFindings(r: SystemResult<Candidate> | undefined, limit = 10): string[] {
  if (!r) return ["System not run for this case."];
  const L: string[] = [];
  L.push(r.candidates.length ? `Candidates (${r.candidates.length}):` : "No candidates surfaced.");
  for (const c of r.candidates.slice(0, limit)) L.push(`  ${candidateLine(c)}`);
  for (const e of r.excluded.slice(0, 10)) L.push(`Excluded by safety checks: ${e.name} — ${e.reason}`);
  for (const a of r.advisories.filter((a) => a.kind === "do-not-offer" || a.kind === "alarm")) L.push(`${a.kind === "alarm" ? "Alarm feature" : "Guideline: do not offer"}: ${a.text}`);
  return L;
}

export function analysisSpecs(a: AnalysisResult, c: CaseInput, idx: KnowledgeIndex, decisions: DecisionLite[] = []): Record<AnalysisSectionKey, PromptSpec> {
  const kb = idx.kb;
  const snap = caseSnapshot(c, idx);
  const free = caseFreeText(c);
  const since = TEN_YEARS_AGO();
  const symIds = a.normalizedSymptoms.map((s) => s.conceptId);
  const symLabels = a.normalizedSymptoms.map((s) => s.label.toLowerCase());
  const chiefTerms = symptomTerms(idx, c.complaint.chiefComplaintId);
  const otherTerms = symIds.filter((s) => s !== c.complaint.chiefComplaintId).slice(0, 3).map((s) => symptomTerms(idx, s, 1)[0]).filter(Boolean);
  const qualifying = a.contexts.filter((x) => x.qualifies);
  const condTerms = uniq(qualifying.flatMap((x) => [x.codes.find((cd) => cd.display)?.display ?? x.label]).map((t) => t.replace(/features?|-type/gi, "").trim().toLowerCase()));
  const presentation = uniq([...condTerms, ...symLabels]).slice(0, 4).join(", ");
  const scope = kb.conditions.map((x) => x.label).join("; ");
  const urgent = a.redFlags.status === "emergency" ? "emergency" as const : a.redFlags.status === "urgent" ? "urgent" as const : undefined;
  const base = { caseData: snap, caseFreeText: free, kbVersion: a.knowledgeBaseVersion, urgent };
  const unrecMeds = a.medicationNormalization.filter((m) => m.via === "unrecognised" || m.via === "fuzzy" || m.via === "class-lexicon");
  const unrecAllergies = a.allergyNormalization.filter((x) => !x.recognised);
  const currentMedTerms = uniq(a.medicationNormalization.flatMap((m) => m.drugIds.map((id) => idx.drug.get(id)?.composition[0]?.name.toLowerCase()).filter(Boolean) as string[]));
  const drugNames = (ids: string[]) => ids.map((id) => idx.drug.get(id)).filter(Boolean).flatMap((d) => drugTerms(d!).slice(0, 1));

  // --- red flags
  const rf = a.redFlags;
  const redFlags: PromptSpec = {
    ...base, kind: "red-flags", title: "Red flags and urgent causes",
    objective: rf.status === "emergency"
      ? `The tool detected EMERGENCY red flag(s): ${rf.findings.filter((f) => f.level === "emergency").map((f) => f.title).join("; ")}. Summarise the current guideline-based recognition and immediate-management pathway for this presentation at first contact and in the emergency department, including referral/transfer criteria and time-critical investigations.`
      : rf.status === "urgent"
        ? `The tool detected URGENT red flag(s): ${rf.findings.map((f) => f.title).join("; ")}. Identify what must be assessed or excluded before symptomatic treatment, the recommended work-up, and the thresholds for same-day referral.`
        : `No red-flag rule matched the entered data for this presentation (${presentation}). Identify serious or time-critical causes that should still be considered, the specific warning features to check, and whether any missing data would change the risk assessment.`,
    questions: [
      "Which serious diagnoses does this presentation raise, and which features distinguish them?",
      "What immediate actions, investigations and referral criteria do current guidelines recommend?",
      "Which validated clinical decision rules or early-warning scores apply (with their sensitivity/specificity)?",
      ...(rf.missingVitals?.length ? [`How would the missing observations (${rf.missingVitals.join(", ")}) change the assessment?`] : []),
      "What should the patient be told to return for (safety-netting)?",
    ],
    toolFindings: [
      `Safety status: ${rf.status}; ${rf.checkedRuleCount} red-flag rules checked.`,
      ...rf.findings.map((f) => `${f.level === "emergency" ? "EMERGENCY" : "Urgent"}: ${f.title} — matched: ${(f.matchedFacts ?? []).join("; ")}. Tool guidance: ${f.detail}`),
      ...(rf.missingVitals?.length ? [`Rules not fully evaluable because these vitals were not recorded: ${rf.missingVitals.join(", ")}`] : []),
    ],
    gaps: ["The tool's red-flag rules are a limited screening set (31 rules); they do not exclude serious illness when nothing matches."],
    searchTerms: {
      pubmed: [
        pubmedQuery([chiefTerms, ["red flag", "warning sign", "serious cause", "emergency", "differential diagnosis"]], "sr", since),
        pubmedQuery([chiefTerms, ["clinical decision rule", "risk score", "diagnostic accuracy"]], "none", since),
      ],
      keywords: uniq([...chiefTerms, ...otherTerms, "red flags", "triage"]),
    },
    sources: [SOURCES.emergency, SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.evidence],
    safetyNotes: ["If any feature suggests a life-threatening condition, say so first and plainly."],
    outputSections: ["Immediate actions and referral criteria", "Serious causes to consider (table: diagnosis | discriminating features | key test | urgency)", "Validated rules/scores and how to apply them", "Safety-netting advice for the clinician to give"],
  };

  // --- patient summary / medication safety
  const patientSummary: PromptSpec = {
    ...base, kind: "patient-summary", title: "Medicines, allergies and patient-safety review",
    objective: "Review this patient's current medicines, allergies and conditions for safety problems: drug–drug and drug–disease interactions, dose adjustment for renal or hepatic function, pregnancy/breastfeeding issues and allergy cross-reactivity. Identify every medicine name the tool could not recognise (including Indian brand names and fixed-dose combinations) and give its generic composition.",
    questions: [
      ...(unrecMeds.length ? [`What exactly are these medicines (generic ingredients, strengths, manufacturer/market, CDSCO approval status): ${unrecMeds.map((m) => `"${m.input}"`).join(", ")}?`] : []),
      ...(unrecAllergies.length ? [`What substances/classes do these recorded allergies refer to, and what cross-reactivity applies: ${unrecAllergies.map((x) => `"${x.substance}"`).join(", ")}?`] : []),
      "Which clinically significant interactions exist between the current medicines (severity, mechanism, management)?",
      "Does any current medicine need stopping, dose adjustment or monitoring given this patient's renal/hepatic function, age, pregnancy status or conditions?",
      "Which allergy cross-reactivities matter when choosing new treatment for this presentation?",
    ],
    toolFindings: [
      ...a.medicationNormalization.map((m) => `Medicine "${m.input}" → ${m.drugIds.length ? m.drugIds.map((d) => d.replace("drug_", "")).join(" + ") : m.classTags.length ? `class ${m.classTags.join(", ")}` : "NOT RECOGNISED"} (matched by ${m.via})${m.note ? `; ${m.note}` : ""}`),
      ...a.allergyNormalization.map((x) => `Allergy "${x.substance}" → ${x.recognised ? x.tags.map((t) => t.replace("allergy:", "")).join(", ") : "NOT RECOGNISED"}`),
      ...a.regimenReview.map((f) => `Current-regimen finding (${f.level}): ${f.title} — ${f.detail}`),
      ...a.patientTagDerivations.map((d) => `Patient factor: ${d}`),
    ],
    gaps: [
      ...unrecMeds.map((m) => `Medicine not (fully) recognised: "${m.input}"${m.note ? ` — ${m.note}` : ""}`),
      ...unrecAllergies.map((x) => `Allergy not recognised: "${x.substance}"`),
      `The tool holds full records for only ${kb.drugs.length} medicines and class-level lexicons for some others; interactions outside these are not checked.`,
    ],
    searchTerms: {
      pubmed: [
        pubmedQuery([uniq(a.medicationNormalization.flatMap((m) => drugNames(m.drugIds))).slice(0, 4), ["drug interaction", "adverse drug event", "contraindication"]], "none", since),
        ...(unrecMeds.length ? [pubmedQuery([unrecMeds.map((m) => m.input.replace(/\d+\s*(mg|mcg|g|ml)\b/gi, "").trim())], "none")] : []),
      ].filter(Boolean),
      keywords: uniq([...c.medications.map((m) => m.name), ...c.patient.allergies.map((x) => x.substance)]),
    },
    sources: [SOURCES.labels, SOURCES.drugSafety, SOURCES.indiaGuidelines, SOURCES.terminology, SOURCES.evidence],
    safetyNotes: ["For brand names, confirm composition from the current Indian package insert or CDSCO record; brand compositions change and the same brand may exist with different ingredients."],
    outputSections: ["Medicine identification (table: name as entered | generic composition | class | source)", "Interactions and conflicts (table: pair or issue | severity | mechanism | management | reference)", "Dose-adjustment and monitoring needs", "Allergy cross-reactivity relevant to new prescribing"],
  };

  // --- clinical context
  const clinicalContext: PromptSpec = {
    ...base, kind: "clinical-context", title: qualifying.length ? "Diagnosis and differential" : "Condition not in the knowledge base",
    objective: qualifying.length
      ? `The tool matched this presentation to: ${qualifying.map((x) => `${x.label} (${x.matched.length}/${x.total} features)`).join("; ")}. Verify whether the diagnostic criteria are actually met, give the full differential diagnosis, and state which findings or investigations would confirm or exclude each possibility.`
      : `The tool's knowledge base has no clinical context that matches this presentation (it currently covers only: ${scope}). Research the likely diagnoses for this presentation from first principles: differential diagnosis, diagnostic criteria, investigations and initial management pathway.`,
    questions: [
      "What is the ranked differential diagnosis, with the features that support or argue against each?",
      "Which formal diagnostic criteria apply (e.g., ICHD-3, ICD-11 definitions, society criteria), and are they met with the data given?",
      "Which investigations are recommended at primary-care level in India, and when is referral indicated?",
      "Which missing history or examination findings would most change the differential?",
      "Give ICD-11 (and ICD-10 if useful) codes for the leading diagnoses.",
    ],
    toolFindings: a.contexts.length ? a.contexts.map((x) => `${x.label}: ${x.qualifies ? "criteria met" : "not met"} (${x.matched.length}/${x.total}, minimum ${x.minimumFeatures}); met: ${x.features.filter((f) => f.status === "met").map((f) => f.label).join(", ") || "none"}; unknown: ${x.features.filter((f) => f.status === "unknown").map((f) => f.label).join(", ") || "none"}${x.alarms.length ? `; ALARM: ${x.alarms.map((al) => al.text).join("; ")}` : ""}`) : ["No curated clinical context applies to these symptoms."],
    gaps: qualifying.length ? ["Context matching uses a small curated feature set; it is not a diagnosis and does not rank alternatives outside the curated scope."] : [`No curated context for: ${symLabels.join(", ")}.`, `Curated scope is limited to: ${scope}.`],
    searchTerms: {
      pubmed: [
        pubmedQuery([chiefTerms, ...otherTerms.slice(0, 1).map((t) => [t]), ["differential diagnosis", "diagnosis", "etiology"]], "sr", since),
        ...(condTerms.length ? [pubmedQuery([condTerms, ["diagnostic criteria", "diagnosis"]], "guideline")] : []),
      ],
      keywords: uniq([...condTerms, ...chiefTerms, ...otherTerms]),
    },
    sources: [SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.evidence, SOURCES.terminology],
    outputSections: ["Differential diagnosis (table: diagnosis | for | against | next step | urgency)", "Diagnostic criteria and whether they are met", "Recommended investigations and referral thresholds"],
  };

  // --- follow-up
  const followUp: PromptSpec = {
    ...base, kind: "follow-up", title: "Targeted history, examination and tests",
    objective: `Suggest the most informative next questions, examination findings and bedside or laboratory tests for this presentation (${presentation}), prioritising those that detect danger or discriminate between the leading diagnoses.`,
    questions: [
      "Which history questions have the highest diagnostic value here (with likelihood ratios where published)?",
      "Which examination findings and bedside tests should be done now?",
      "Which validated questionnaires, scores or clinical decision rules apply?",
      ...(c.systems.includes("ayurveda") ? ["For Ayurvedic assessment: which examination points (e.g., Ashtavidha/Dashavidha Pariksha) are most relevant, with classical references?"] : []),
      ...(c.systems.includes("homeopathy") ? ["For homeopathic case-taking: which modalities, concomitants and characteristic symptoms would most discriminate between the leading remedies?"] : []),
    ],
    toolFindings: a.followUp.map((f) => `[${f.priority}] ${f.question} — ${f.reason}`),
    gaps: ["The tool's follow-up list is generated from rule gaps only; it does not use published diagnostic-accuracy data."],
    searchTerms: { pubmed: [pubmedQuery([chiefTerms, ["history taking", "physical examination", "likelihood ratio", "diagnostic accuracy", "clinical prediction rule"]], "none", since)], keywords: uniq([...chiefTerms, "diagnostic accuracy", "likelihood ratio"]) },
    sources: [SOURCES.intlGuidelines, SOURCES.indiaGuidelines, SOURCES.evidence],
    outputSections: ["Priority questions (table: question | why | what a positive answer changes)", "Examination and bedside tests", "Scores and decision rules"],
  };

  // --- allopathy
  const allo = a.allopathy;
  const alloCandidates = allo?.candidates.map((x) => x.entityId) ?? [];
  const allopathy: PromptSpec = {
    ...base, kind: "allopathy", system: "allopathy", title: "Allopathic management options",
    objective: `Identify evidence-based conventional (allopathic) management for this patient's presentation (${presentation}), including options that are NOT in the tool's list, and check each option against this patient's safety factors.`,
    questions: [
      "What do current guidelines recommend first-line (drug and non-drug), and what are the second-line options?",
      "For each option: effectiveness evidence (with effect sizes where available), key adverse effects, and suitability for THIS patient (age, pregnancy/breastfeeding, renal/hepatic function, allergies, current medicines).",
      ...(allo?.excluded.length ? [`The tool excluded ${allo.excluded.map((e) => e.name).join(", ")} for safety reasons — confirm the reasons and identify safe alternatives.`] : []),
      "Are the options available in India (NLEM listing, common formulations), and are there relevant Indian prescribing considerations?",
      "What monitoring, follow-up interval and referral criteria are recommended?",
    ],
    toolFindings: systemFindings(allo),
    gaps: [
      ...(allo?.notFound ?? []),
      ...(qualifying.length ? [] : ["No curated clinical context matched, so the tool generated no guideline-linked options."]),
      `The tool holds guideline links for only ${kb.clinicalGuidelines.length} guidelines and ${kb.drugs.length} medicines; many standard options are outside its knowledge base.`,
      ...unrecMeds.map((m) => `Current medicine not recognised (interaction checks incomplete): "${m.input}"`),
    ],
    searchTerms: {
      pubmed: [
        pubmedQuery([condTerms.length ? condTerms : chiefTerms, ["treatment", "management", "therapy"]], "guideline", since),
        pubmedQuery([condTerms.length ? condTerms : chiefTerms, uniq(drugNames(alloCandidates)).slice(0, 5)], "sr+rct", since),
        ...(currentMedTerms.length ? [pubmedQuery([currentMedTerms.slice(0, 3), ["drug interaction", "bleeding", "adverse drug event"]], "none", since)] : []),
      ].filter(Boolean),
      keywords: uniq([...condTerms, ...chiefTerms, ...drugNames(alloCandidates), ...currentMedTerms]),
    },
    sources: [SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.evidence, SOURCES.labels, SOURCES.drugSafety],
    outputSections: ["Recommended options (table: option | line of therapy | evidence & certainty | suitability for this patient | reference numbers)", "Non-drug measures", "Monitoring, follow-up and referral"],
  };

  // --- ayurveda
  const ay = a.ayurveda;
  const bridged = (ay?.advisories.find((x) => /bridged to classical terms/i.test(x.text))?.text ?? "").replace(/^.*?:\s*/, "").replace(/\.$/, "");
  const ayNames = (ay?.candidates ?? []).slice(0, 6).map((x) => x.name);
  const botanicals = (ay?.candidates ?? []).filter((x) => x.kind === "herb").map((x) => /\(([^)]+)\)/.exec(x.name)?.[1]).filter(Boolean) as string[];
  const ayurveda: PromptSpec = {
    ...base, kind: "ayurveda", system: "ayurveda", title: "Ayurvedic options — classical and modern evidence",
    objective: `Research Ayurvedic management for this presentation (${presentation}${bridged ? `; classical correlates considered by the tool: ${bridged}` : ""}). Report classical references, modern clinical evidence and safety SEPARATELY for each option, and check suitability for this patient.`,
    questions: [
      "What is the classical Ayurvedic understanding of this presentation (nidana, samprapti, dosha involvement) and its line of management (chikitsa sutra)? Cite text and chapter.",
      "Which herbs and formulations are indicated classically, and which are included in the API/AFI? Give the official formulation name and composition.",
      "What modern clinical evidence exists for each option (RCTs, systematic reviews; include CCRAS and AYUSH-portal studies), and how reliable is it?",
      "Safety: hepatotoxicity, heavy metals (Rasaushadhi), pregnancy/breastfeeding, and interactions with this patient's current medicines.",
      "How should the clinician's dosha/agni/ama assessment modify the choice (classical rationale)?",
    ],
    toolFindings: [...systemFindings(ay, 12), ...(ay?.advisories.filter((x) => x.kind === "note").slice(0, 4).map((x) => `Note: ${x.text}`) ?? [])],
    gaps: [
      ...(ay?.notFound ?? []),
      "Symptom-to-classical-term bridges in the tool are approximate correlates, not NAMASTE codes.",
      "The tool's datasets record classical indications and properties only; they contain no modern clinical-evidence or dosing verification.",
    ],
    searchTerms: {
      pubmed: [
        pubmedQuery([["ayurveda", "ayurvedic"], condTerms.length ? condTerms : chiefTerms], "sr+rct"),
        ...(botanicals.length ? [pubmedQuery([botanicals.slice(0, 4), ["clinical trial", "randomized", "systematic review", "safety"]], "none")] : []),
        ...(botanicals.length ? [pubmedQuery([botanicals.slice(0, 4), ["hepatotoxicity", "herb-drug interaction", "adverse"]], "none")] : []),
      ],
      keywords: uniq([...ayNames, ...(bridged ? bridged.split(/;\s*/) : []), ...chiefTerms]),
    },
    sources: [SOURCES.ayurvedaClassical, SOURCES.ayurvedaOfficial, SOURCES.evidence, SOURCES.herbSafety, SOURCES.labels],
    safetyNotes: [
      "Flag Rasaushadhi (mineral/metal) preparations and quote published heavy-metal findings.",
      "State clearly when an option has only classical/traditional support and no modern clinical evidence.",
    ],
    outputSections: ["Classical understanding and line of management (with text references)", "Options (table: herb/formulation | classical indication & reference | API/AFI status | modern evidence & certainty | safety for this patient | reference numbers)", "Herb–drug interactions with the current medicines"],
  };

  // --- homeopathy
  const ho = a.homeopathy;
  const remedyNames = (ho?.candidates ?? []).slice(0, 6).map((x) => x.name);
  const homeopathy: PromptSpec = {
    ...base, kind: "homeopathy", system: "homeopathy", title: "Homeopathic remedy comparison and evidence",
    objective: "Compare the remedies suggested by repertorization using materia medica, and summarise the current scientific evidence on homeopathy for this presentation, including safety. Present materia-medica reasoning and scientific evidence separately.",
    questions: [
      "For the top remedies, what are the characteristic (keynote) symptoms in the materia medica, and which features of this case support or argue against each? Cite the materia medica.",
      "Which additional symptoms, modalities or concomitants would best differentiate between them?",
      "Are the chosen rubrics appropriate for the case, and are there better rubrics in major repertories (Kent, Synthesis, Complete)?",
      "What do systematic reviews and meta-analyses conclude about homeopathy for this condition? Report risk of bias and certainty.",
      "Safety: toxic source materials, low potencies, and the risk of delaying effective treatment for this presentation.",
    ],
    toolFindings: [
      ...(ho?.rubricsUsed ?? []).map((r) => `Rubric: ${r.path} (×${r.weight}, ${r.remedyCount} remedies, ${r.origin})`),
      ...systemFindings(ho, 10),
    ],
    gaps: [
      ...(ho?.notFound ?? []),
      ...((ho?.rubricsUsed ?? []).some((r) => r.origin === "auto-suggested") ? ["Some rubrics were auto-suggested by the tool from structured symptom fields and are provisional."] : []),
      "The tool holds one repertory (Repertorium Publicum) and one materia medica (Boericke, 1906) only.",
      "Repertorization shows how often and how strongly remedies are listed; it is not evidence of effectiveness.",
    ],
    searchTerms: {
      pubmed: [
        pubmedQuery([["homeopathy", "homoeopathy", "homeopathic"], condTerms.length ? condTerms : chiefTerms], "sr+rct"),
        pubmedQuery([["homeopathy", "homoeopathy"], ["systematic review", "meta-analysis", "evidence"]], "sr"),
      ],
      keywords: uniq([...remedyNames, ...chiefTerms, "individualised homeopathy"]),
    },
    sources: [SOURCES.homeoMM, SOURCES.homeoEvidence, SOURCES.evidence],
    safetyNotes: ["State plainly where scientific evidence does not support efficacy; do not present repertory grades or provings as evidence of clinical effect."],
    outputSections: ["Remedy differentiation (table: remedy | keynotes | case features for | against | materia medica reference)", "Rubric review", "Scientific evidence for this condition (with certainty)"],
  };

  // --- comparison
  const comparison: PromptSpec = {
    ...base, kind: "comparison", system: "integrative", title: "Integrative comparison and cross-system safety",
    objective: "Compare the options surfaced across the systems the clinician requested, focusing on the strength of evidence for each and on safety when systems are combined (herb–drug interactions, duplicated effects, delays in effective care).",
    questions: [
      "What is the strength of evidence for each option, compared on the same outcomes where possible?",
      "Which combinations across systems are unsafe or need monitoring (herb–drug interactions, additive effects)?",
      "Which option should not be used as a substitute for effective conventional care in this presentation?",
      "What would an evidence-informed, safe integrative plan need to avoid?",
    ],
    toolFindings: (["allopathy", "ayurveda", "homeopathy"] as const).filter((s) => c.systems.includes(s)).flatMap((s) => [`## ${cap(s)}`, ...(a[s]?.candidates.slice(0, 5).map(candidateLine) ?? ["not run"])]),
    gaps: ["Each system in the tool uses its own method (guideline match, classical-indication match, repertory match); their scores are not comparable."],
    searchTerms: { pubmed: [pubmedQuery([ayNames.map((n) => /\(([^)]+)\)/.exec(n)?.[1] ?? n).slice(0, 3), drugNames(alloCandidates).slice(0, 3), ["interaction"]], "none")].filter(Boolean), keywords: uniq(["herb-drug interaction", "integrative medicine", ...chiefTerms]) },
    sources: [SOURCES.herbSafety, SOURCES.drugSafety, SOURCES.evidence, SOURCES.homeoEvidence],
    outputSections: ["Evidence comparison (table: option | system | outcome | certainty)", "Cross-system interactions and cautions", "What not to substitute"],
  };

  // --- conflicts
  const conflicts: PromptSpec = {
    ...base, kind: "conflicts", title: "Resolve conflicting information",
    objective: "The tool found conflicting or uncertain information for this case. Evaluate each conflict: compare the sources, their recency and methodological quality, and state which position is better supported and which applies to this patient and to Indian practice.",
    questions: ["For each conflict: what does each side claim, on what evidence, and how strong is it?", "Has newer evidence (last 5 years) changed the balance?", "What is the practical implication for this patient?"],
    toolFindings: [...a.conflicts.map((x) => `${x.topic}: ${x.detail} (sources: ${x.sources.map((s) => s.reference ?? s.sourceId).join("; ")})`), `Sources the tool used: ${a.sourcesUsed.join(", ")}`],
    gaps: a.conflicts.length ? [] : ["No explicit conflict was detected by the tool; check whether guideline recommendations cited differ across jurisdictions."],
    searchTerms: { pubmed: [pubmedQuery([chiefTerms, ["systematic review", "guideline"]], "sr", since)], keywords: uniq(a.conflicts.map((x) => x.topic)) },
    sources: [SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.evidence],
    outputSections: ["Conflict-by-conflict appraisal (table: topic | position A | position B | better supported | why)", "Implications for this patient"],
  };

  // --- decisions
  const decisionsSpec: PromptSpec = {
    ...base,
    caseFreeText: [free, ...decisions.filter((d) => d.reason).map((d) => `Reason recorded for ${d.action} ${d.candidateName}: ${scrubIdentifiers(d.reason!)}`)].filter(Boolean).join("\n") || undefined,
    kind: "decisions", title: "Appraise the documented plan",
    objective: "Critically appraise the clinician's documented decisions for this case against current guidelines and evidence, and against this patient's safety factors. Do not override the clinician; identify risks, omissions and monitoring needs.",
    questions: ["Are the accepted options concordant with current guidelines for this patient?", "Are there safety issues, interactions or omissions (e.g., missing safety-netting, monitoring or referral)?", "What follow-up interval and review criteria are appropriate?"],
    toolFindings: decisions.length ? decisions.map((d) => `Decision: ${d.action} — ${d.candidateName} (${d.system})${d.alternative ? ` → alternative chosen: ${d.alternative}` : ""}`) : ["No decisions recorded yet — appraise the candidate options instead."],
    gaps: [],
    searchTerms: { pubmed: [pubmedQuery([condTerms.length ? condTerms : chiefTerms, ["management", "treatment"]], "guideline", since)], keywords: uniq([...decisions.map((d) => d.candidateName), ...chiefTerms]) },
    sources: [SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.evidence, SOURCES.labels],
    outputSections: ["Concordance with guidelines", "Risks and omissions", "Monitoring and follow-up"],
  };

  return { redFlags, patientSummary, clinicalContext, followUp, allopathy, ayurveda, homeopathy, comparison, conflicts, decisions: decisionsSpec };
}

/** Whole-case research brief (case page). */
export function caseSpec(c: CaseInput, idx: KnowledgeIndex, a?: AnalysisResult): PromptSpec {
  const chiefTerms = symptomTerms(idx, c.complaint.chiefComplaintId);
  const since = TEN_YEARS_AGO();
  const systems = c.systems.map(cap).join(", ");
  return {
    kind: "case", title: "Full case research brief",
    objective: `Prepare a complete, evidence-based research brief for this case: red flags, differential diagnosis, investigations, and management options in the systems the clinician requested (${systems}), with safety checks for this patient.`,
    questions: [
      "Which red flags or serious causes must be excluded first?",
      "What is the differential diagnosis and the recommended work-up?",
      ...c.systems.map((s) => s === "allopathy" ? "Allopathy: guideline-based first- and second-line options, with evidence and suitability for this patient." : s === "ayurveda" ? "Ayurveda: classical line of management and options (with text references), modern evidence and safety, kept separate." : "Homeopathy: materia-medica comparison of likely remedies, and the scientific evidence and safety position, kept separate."),
      "Interactions and contraindications with the current medicines, allergies and conditions.",
      "Follow-up, monitoring and referral criteria.",
    ],
    caseData: caseSnapshot(c, idx),
    caseFreeText: caseFreeText(c),
    toolFindings: a ? [
      `Latest analysis: red-flag status ${a.redFlags.status}${a.redFlags.findings.length ? ` (${a.redFlags.findings.map((f) => f.title).join("; ")})` : ""}`,
      `Contexts met: ${a.contexts.filter((x) => x.qualifies).map((x) => x.label).join("; ") || "none"}`,
      ...(["allopathy", "ayurveda", "homeopathy"] as const).filter((s) => a[s]).map((s) => `${cap(s)}: ${a[s]!.candidates.slice(0, 5).map((x) => x.name).join(", ") || "no candidates"}${a[s]!.excluded.length ? `; excluded: ${a[s]!.excluded.map((e) => e.name).join(", ")}` : ""}`),
    ] : ["The case has not been analysed by the tool yet."],
    gaps: a && !a.contexts.some((x) => x.qualifies) ? ["No curated clinical context matched this presentation in the tool's knowledge base."] : [],
    kbVersion: a?.knowledgeBaseVersion,
    urgent: a?.redFlags.status === "emergency" ? "emergency" : a?.redFlags.status === "urgent" ? "urgent" : undefined,
    searchTerms: { pubmed: [pubmedQuery([chiefTerms, ["diagnosis", "management"]], "sr", since), pubmedQuery([chiefTerms, ["treatment"]], "guideline", since)], keywords: chiefTerms },
    sources: [SOURCES.emergency, SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.evidence, SOURCES.labels, ...(c.systems.includes("ayurveda") ? [SOURCES.ayurvedaClassical, SOURCES.ayurvedaOfficial, SOURCES.herbSafety] : []), ...(c.systems.includes("homeopathy") ? [SOURCES.homeoMM, SOURCES.homeoEvidence] : [])],
    outputSections: ["Red flags and immediate actions", "Differential diagnosis and work-up", ...c.systems.map((s) => `${cap(s)} options`), "Interactions and contraindications for this patient", "Follow-up and referral"],
  };
}

// ------------------------------------------------------------------ reference pages

export function drugSpec(d: Drug, idx: KnowledgeIndex): PromptSpec {
  const terms = drugTerms(d);
  const ix = idx.kb.drugInteractions.filter((x) => x.a === d.id || x.b === d.id || d.classTags.some((t) => x.a === `class:${t}` || x.b === `class:${t}`));
  return {
    kind: "drug", system: "allopathy", title: `Verify and update: ${d.name}`,
    objective: `Verify and update the key clinical facts for ${d.name} (${d.genericName}) against current official product information and recent evidence, and list what is relevant to prescribing in India.`,
    questions: [
      "Approved indications in India (CDSCO) and internationally; is it in NLEM 2022, and in which formulations?",
      "Mechanism of action and clinically relevant pharmacokinetics.",
      "Contraindications, boxed/serious warnings, and major interactions (with severity and management).",
      "Use in pregnancy (by trimester) and breastfeeding; renal and hepatic dose adjustment; use in children and older adults.",
      "Recent safety communications (PvPI, FDA, EMA, MHRA) and important new evidence from the last 5 years.",
      "Common Indian brand names and fixed-dose combinations containing it (flag irrational or banned FDCs).",
      "Which of the tool's recorded facts below are inaccurate, incomplete or outdated?",
    ],
    toolFindings: [
      `Verification status in the tool: ${d.verification}`,
      `What it is: ${d.whatItIs}`, `What it does: ${d.whatItDoes}`, `Mechanism: ${d.mechanism}`,
      `Used for: ${d.usedFor.join("; ")}`,
      ...d.contraindications.map((r) => `Contraindication/avoid (${r.severity}; when ${r.when.join(", ")}): ${r.text}`),
      ...d.warnings.map((r) => `Warning (${r.severity}; when ${r.when.join(", ")}): ${r.text}`),
      ...ix.map((x) => `Interaction ${x.a.replace(/^drug_|^class:/, "")} + ${x.b.replace(/^drug_|^class:/, "")} (${x.severity}): ${x.effect}`),
      `Brand mappings: ${d.brandMappings.map((b) => `${b.brand} (${b.country}) = ${b.composition.join(" + ")}`).join("; ") || "none"}`,
      `RXCUI: ${d.rxcui ?? "not recorded"}`,
    ],
    gaps: [...(d.verification === "curated-pending-verification" ? ["These facts are hand-curated and have not yet been verified against the current label."] : []), "No ATC code, NLEM status or Indian-label (CDSCO) text is held by the tool."],
    searchTerms: { pubmed: [pubmedQuery([terms, ["safety", "adverse effects", "drug interactions"]], "sr", TEN_YEARS_AGO()), pubmedQuery([terms, ["pregnancy", "lactation", "breastfeeding"]], "none")], keywords: uniq([...terms, ...d.brandMappings.map((b) => b.brand)]) },
    sources: [SOURCES.labels, SOURCES.indiaGuidelines, SOURCES.drugSafety, SOURCES.evidence, SOURCES.terminology],
    outputSections: ["Verified facts (table: topic | current fact | source | differs from tool? )", "Prescribing considerations in India", "Recent safety communications and new evidence"],
  };
}

export function herbSpec(h: AyurvedicHerb): PromptSpec {
  const terms = uniq([h.botanicalName, h.name, h.englishName].filter(Boolean).map((x) => x.toLowerCase()));
  return {
    kind: "herb", system: "ayurveda", title: `Research herb: ${h.name}`,
    objective: `Research the Ayurvedic herb ${h.name} (${h.botanicalName}): classical properties and indications with references, official monograph status, pharmacology, modern clinical evidence and safety. Keep classical and modern evidence separate.`,
    questions: [
      "Classical properties (rasa, guna, virya, vipaka, prabhava, karma) and indications — cite text and chapter.",
      "Is there an Ayurvedic Pharmacopoeia of India (API) monograph? Which part is used, and what identity/purity standards apply?",
      "Key phytochemistry and pharmacology relevant to the classical indications.",
      "Human clinical evidence (RCTs, systematic reviews) — for which conditions, how strong?",
      "Safety: hepatotoxicity or other serious adverse effects, pregnancy/breastfeeding, herb–drug interactions, adulteration or substitution problems.",
      "Which of the tool's recorded properties below disagree with standard references?",
    ],
    toolFindings: [
      `Rasa ${h.rasa.join(", ") || "—"}; guna ${h.guna.join(", ") || "—"}; virya ${h.virya || "—"}; vipaka ${h.vipaka || "—"}; prabhava/karma ${h.prabhava.join(", ") || "—"}`,
      `Pacifies ${h.tridosha ? "tridosha" : h.pacifies.join(", ") || "—"}; aggravates ${h.aggravates.join(", ") || "—"}`,
      `Main indications recorded: ${h.mainIndications.join(", ") || "—"}`,
      ...h.safetyNotes.map((n) => `Safety note (${n.level}): ${n.text}`),
      `Source: ${h.sources.map((s) => s.reference ?? s.sourceId).join("; ")}`,
    ],
    gaps: ["The tool records classical properties from an open dataset only; no modern clinical evidence or official monograph text is held."],
    searchTerms: { pubmed: [pubmedQuery([[h.botanicalName]], "sr+rct"), pubmedQuery([[h.botanicalName], ["hepatotoxicity", "toxicity", "adverse", "interaction"]], "none")], keywords: terms },
    sources: [SOURCES.ayurvedaClassical, SOURCES.ayurvedaOfficial, SOURCES.evidence, SOURCES.herbSafety],
    outputSections: ["Classical profile (with references)", "Official standards", "Modern clinical evidence (table: condition | study type | result | certainty | reference)", "Safety and interactions"],
  };
}

export function formulationSpec(f: AyurvedicFormulation): PromptSpec {
  return {
    kind: "formulation", system: "ayurveda", title: `Research formulation: ${f.name}`,
    objective: `Research the Ayurvedic formulation ${f.name} (${f.formulationType}): classical source and composition, official formulary status, indications, modern evidence and safety${f.containsMineralsOrMetals ? " — it contains mineral/metal ingredients (Rasaushadhi), so address heavy-metal safety in detail" : ""}.`,
    questions: [
      "Classical source text and chapter; is it in the Ayurvedic Formulary of India (AFI), and does the AFI composition match the one below?",
      "Classical indications and anupana; dose as stated in the AFI or classical text (quote and cite).",
      "Modern clinical studies (RCTs, observational), quality of evidence.",
      "Safety: heavy metals and published toxicity reports, hepatotoxic ingredients, pregnancy/breastfeeding, herb–drug interactions.",
      "Manufacturing/quality standards and regulatory notices in India.",
    ],
    toolFindings: [
      `Category: ${f.category}`, `Ingredients as recorded: ${f.ingredientsText}`, `Indications as recorded: ${f.indicationsText}`,
      `Classical reference as stated in dataset: ${f.classicalReference || "—"}`, `Dose stated in dataset: ${f.sourceReportedDose ?? "—"}; anupana: ${f.anupana ?? "—"}`,
      ...f.safetyNotes.map((n) => `Safety note (${n.level}): ${n.text}`),
    ],
    gaps: ["The dataset's classical references and doses have not been checked against the source texts or the AFI."],
    searchTerms: { pubmed: [pubmedQuery([[f.name.replace(/\(.*\)/, "").trim()]], "none"), ...(f.containsMineralsOrMetals ? [pubmedQuery([["ayurvedic"], ["heavy metal", "lead", "mercury", "arsenic"]], "none")] : [])], keywords: uniq([f.name, ...f.mainIngredients]) },
    sources: [SOURCES.ayurvedaClassical, SOURCES.ayurvedaOfficial, SOURCES.evidence, SOURCES.herbSafety],
    outputSections: ["Classical source and official composition", "Indications and stated dose (quoted, with source)", "Modern evidence", "Safety, quality and regulatory status"],
  };
}

export function remedySpec(r: HomeopathyRemedy, toxic?: { material: string; note: string }): PromptSpec {
  return {
    kind: "remedy", system: "homeopathy", title: `Research remedy: ${r.name}`,
    objective: `Research the homeopathic remedy ${r.name} (${r.abbrev}): source substance, materia-medica profile across standard sources, and the scientific evidence and safety position. Keep materia-medica descriptions separate from scientific evidence.`,
    questions: [
      "Source substance and preparation; any toxicity of the source material and at which potencies it matters.",
      "Keynotes, modalities and main spheres of action in standard materia medica (compare Boericke with Clarke, Allen, Hering).",
      "Remedies it is most often confused with, and differentiating features.",
      "Clinical studies of this remedy (RCTs, systematic reviews) and their quality.",
      "Regulatory or safety notices involving products containing it.",
    ],
    toolFindings: [`Remedy ${r.name} (${r.abbrev}); alternative names: ${r.altNames.join(", ") || "—"}`, ...(toxic ? [`Toxic source flagged: ${toxic.material}. ${toxic.note}`] : []), "Materia medica held by the tool: Boericke (1906) only."],
    gaps: ["The tool holds one historical materia medica; no clinical-trial data are held."],
    searchTerms: { pubmed: [pubmedQuery([[r.name], ["homeopathy", "homoeopathic", "homeopathic"]], "none")], keywords: uniq([r.name, r.abbrev, ...r.altNames]) },
    sources: [SOURCES.homeoMM, SOURCES.homeoEvidence, SOURCES.evidence],
    safetyNotes: ["Do not present provings or clinical tradition as evidence of efficacy."],
    outputSections: ["Source substance and safety", "Materia-medica profile (with references)", "Differential remedies", "Scientific evidence (with certainty)"],
  };
}

/** Something the clinician searched for or entered that the knowledge base does not hold (condition, medicine, herb…). */
export function termSpec(term: string, opts: { hint?: "condition" | "medicine" | "ayurveda" | "homeopathy" | "any"; nearMatches?: string[]; context?: string } = {}): PromptSpec {
  const t = term.trim().slice(0, 120);
  const hint = opts.hint ?? "any";
  const interpretations = {
    any: "a symptom or medical condition, an allopathic medicine (generic name, or Indian/international brand, including fixed-dose combinations), an Ayurvedic herb or formulation, or a homeopathic remedy",
    condition: "a symptom, sign or medical condition (including regional-language or colloquial terms)",
    medicine: "an allopathic medicine — a generic name, or an Indian or international brand name, including fixed-dose combinations",
    ayurveda: "an Ayurvedic herb (dravya), formulation (kalpana) or classical disease term",
    homeopathy: "a homeopathic remedy (full name or abbreviation) or a repertory term",
  }[hint];
  return {
    kind: "term", title: `Research "${t}" — not in the knowledge base`,
    objective: `A clinician looked up "${t}" in a clinical decision-support tool and it was not found (or only partly matched). Identify what "${t}" most likely refers to — ${interpretations} — list every plausible interpretation (including spelling variants and Hindi or other Indian-language terms), then give the key clinical facts for the most likely ones, with citations.`,
    questions: [
      `What does "${t}" most likely refer to? Give standard names and synonyms.`,
      "Standard codes where applicable: ICD-11/SNOMED CT (conditions); INN generic name, RxNorm and WHO ATC (medicines), CDSCO approval status in India; botanical name and API/AFI entry (Ayurveda); standard abbreviation (homeopathy).",
      "For a condition: definition, key diagnostic features, red flags, and first-line management per current guidelines.",
      "For a medicine: composition, class, main indications, contraindications, serious warnings and major interactions; availability in India.",
      "For an Ayurvedic or homeopathic item: classical/materia-medica description (with references), modern evidence and safety — kept separate.",
      ...(opts.context ? [`Relevance to this context: ${opts.context}`] : []),
    ],
    toolFindings: opts.nearMatches?.length ? [`Closest entries the tool found (may be unrelated): ${opts.nearMatches.slice(0, 8).join("; ")}`] : ["The tool found no matching entry."],
    gaps: [`"${t}" is not in the tool's knowledge base.`],
    searchTerms: { pubmed: [pubmedQuery([[t]], "none")], keywords: [t] },
    sources: [SOURCES.terminology, SOURCES.indiaGuidelines, SOURCES.intlGuidelines, SOURCES.labels, SOURCES.evidence, ...(hint === "ayurveda" || hint === "any" ? [SOURCES.ayurvedaOfficial] : []), ...(hint === "homeopathy" || hint === "any" ? [SOURCES.homeoMM] : [])],
    safetyNotes: ["If the term is ambiguous, say so and do not guess a single answer; list the interpretations with how to tell them apart."],
    outputSections: ["Interpretations (table: interpretation | type | standard name/code | how likely | how to confirm)", "Key facts for the most likely interpretation(s)"],
  };
}

/** Repertory selector (client): compare remedies for the rubrics the clinician chose. */
export function repertorySpec(rubrics: { path: string; weight: number }[], rows: { abbrev: string; name: string; covered: number; gradeSum: number; weightedScore: number }[]): PromptSpec {
  const top = rows.slice(0, 8);
  return {
    kind: "repertory", system: "homeopathy", title: "Compare repertorized remedies",
    objective: "Using standard materia medica and repertories, compare the remedies below for the selected rubrics: which characteristic symptoms support each, what would differentiate them, and whether the rubric selection is sound. Then state the scientific evidence position separately.",
    questions: [
      "Keynotes and modalities of each top remedy that match (or contradict) the selected rubrics — cite the materia medica.",
      "Which further symptoms would best differentiate the top 3–5 remedies?",
      "Are there more specific or better-graded rubrics in major repertories (Kent, Synthesis, Complete)?",
      "What does current scientific evidence say about homeopathy for the underlying complaint (systematic reviews, certainty)?",
    ],
    toolFindings: [
      "## Selected rubrics (Repertorium Publicum)",
      ...rubrics.map((r) => `${r.path}${r.weight > 1 ? ` (weight ×${r.weight})` : ""}`),
      "## Repertorization result (coverage, then weighted grade sum)",
      ...top.map((r) => `${r.name} (${r.abbrev}): ${r.covered}/${rubrics.length} rubrics, grade sum ${r.gradeSum}, weighted ${r.weightedScore}`),
    ],
    gaps: ["Repertorization counts listings and grades; it is not evidence of effectiveness.", "The tool holds one repertory and one materia medica (Boericke, 1906)."],
    searchTerms: { pubmed: [pubmedQuery([["homeopathy", "homoeopathy"], top.slice(0, 3).map((r) => r.name)], "none")], keywords: top.map((r) => r.name) },
    sources: [SOURCES.homeoMM, SOURCES.homeoEvidence, SOURCES.evidence],
    safetyNotes: ["Do not present repertory grades or provings as evidence of clinical effect."],
    outputSections: ["Remedy differentiation (table: remedy | matching keynotes | contradicting features | reference)", "Rubric review", "Evidence position"],
  };
}

/** Admin: verify the hand-curated drug facts that are still pending verification. */
export function verificationSpec(drugs: Drug[]): PromptSpec {
  const pending = drugs.filter((d) => d.verification !== "curated-verified");
  return {
    kind: "verification", system: "allopathy", title: "Verify pending drug facts",
    objective: `Verify the hand-curated medicine facts below against current official product information (Indian package inserts/CDSCO where available, otherwise DailyMed/EMC). For each medicine, report every statement that is wrong, outdated or missing an important item.`,
    questions: ["For each medicine: are the contraindications and serious warnings complete and correct?", "Are the listed brand compositions correct for the Indian market today?", "Is the RXCUI correct (RxNav)?", "Which important interactions are missing?"],
    toolFindings: pending.flatMap((d) => [`## ${d.name} (RXCUI ${d.rxcui ?? "—"})`, `Contraindications: ${d.contraindications.map((r) => r.text).join(" | ") || "none recorded"}`, `Warnings: ${d.warnings.map((r) => r.text).join(" | ") || "none recorded"}`, `Brands: ${d.brandMappings.map((b) => `${b.brand} = ${b.composition.join(" + ")}`).join("; ") || "none"}`]),
    gaps: [`${pending.length} medicines are marked "curated-pending-verification".`],
    searchTerms: { pubmed: [], keywords: pending.map((d) => d.genericName) },
    sources: [SOURCES.labels, SOURCES.drugSafety, SOURCES.terminology],
    outputSections: ["Discrepancies (table: medicine | tool statement | correct statement | source)", "Missing items to add"],
  };
}
