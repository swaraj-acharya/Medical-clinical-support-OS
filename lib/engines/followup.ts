import type { ContextMatch, FollowUpQuestion, RedFlagResult } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import type { PatientState } from "../safety/patient-state";
import type { CaseInput } from "../validation/case-schema";

const VITAL_Q: Record<string, string> = {
  temperatureC: "Record temperature (°C).", heartRate: "Record heart rate.", respiratoryRate: "Record respiratory rate.",
  systolicBP: "Record blood pressure.", diastolicBP: "Record blood pressure.", spo2: "Record oxygen saturation (SpO₂).", gcs: "Record level of consciousness (GCS/AVPU).",
};

/**
 * Prioritised follow-up questions: safety gaps first (unchecked red-flag items, missing vitals referenced by red-flag rules,
 * unknown pregnancy status), then diagnostic features that would change context matching, then characterisation, then
 * system-specific questions (repertory modalities, Ayurvedic assessment).
 */
export function followUpQuestions(c: CaseInput, st: PatientState, idx: KnowledgeIndex, rf: RedFlagResult, contexts: ContextMatch[]): FollowUpQuestion[] {
  const q: FollowUpQuestion[] = [];
  const push = (x: FollowUpQuestion) => { if (!q.some((y) => y.id === x.id || y.question === x.question)) q.push(x); };

  // --- safety
  for (const f of idx.kb.redFlagChecklist) {
    if (!f.appliesTo.some((s) => st.symptomsPresent.has(s)) || st.flags.has(f.id)) continue;
    push({ id: `fq:flag:${f.id}`, priority: "high", purpose: "safety", question: `Ask/check: ${f.label}?`, reason: "Red-flag checklist item relevant to the presenting symptoms has not been ticked.", systems: ["shared"] });
  }
  const hs = st.symptomDetail.get("sym_headache");
  if (st.symptomsPresent.has("sym_headache") && (!hs?.onset || hs.onset === "unknown"))
    push({ id: "fq:headache-onset", priority: "high", purpose: "safety", question: "Did the headache start suddenly (reaching maximum intensity within minutes)?", reason: "Onset is required by the thunderclap-headache red-flag rule.", systems: ["shared"] });
  const missing = [...new Set((rf.missingVitals ?? []).map((m) => VITAL_Q[m]).filter(Boolean))];
  if (missing.length)
    push({ id: "fq:vitals", priority: rf.status === "clear" ? "medium" : "high", purpose: "safety", question: `Record missing vital signs: ${missing.map((v) => v.replace(/^Record |\.$/g, "")).join("; ")}.`, reason: "Referenced by red-flag rules (e.g., NEWS2, qSOFA) but not recorded — those rules could not be fully evaluated.", systems: ["shared"] });
  if (st.tags.has("pregnancy-status-unknown"))
    push({ id: "fq:pregnancy", priority: "high", purpose: "safety", question: "Could the patient be pregnant? Record pregnancy status.", reason: "Pregnancy status changes red-flag rules and medicine contraindications.", systems: ["shared"] });
  if (st.tags.has("pregnant") && c.patient.gestationalWeeks === undefined)
    push({ id: "fq:gestation", priority: "high", purpose: "safety", question: "Record gestational age (weeks).", reason: "Several restrictions apply from 20 weeks.", systems: ["allopathy"] });
  if (st.tags.has("dengue-risk"))
    push({ id: "fq:dengue", priority: "high", purpose: "safety", question: "Has dengue been excluded (NS1/IgM/platelet count as locally indicated)? Any warning signs — abdominal pain, persistent vomiting, mucosal bleeding, lethargy?", reason: "Fever sets the India-first dengue-risk rule; NSAIDs/aspirin are withheld until dengue is excluded.", systems: ["allopathy"] });
  for (const m of st.meds.filter((m) => m.via === "unrecognised" || m.via === "fuzzy"))
    push({ id: `fq:med:${m.input}`, priority: "medium", purpose: "medication", question: `Confirm the medicine "${m.input}" (generic name and strength).`, reason: m.note ?? "Not confidently recognised — interaction checks incomplete.", systems: ["shared"] });
  for (const a of st.allergies.filter((a) => !a.recognised))
    push({ id: `fq:allergy:${a.substance}`, priority: "medium", purpose: "medication", question: `Clarify the allergy "${a.substance}" (substance and reaction).`, reason: a.note ?? "Allergy not matched.", systems: ["shared"] });
  const wantsAllo = c.systems.includes("allopathy");
  if (wantsAllo && c.patient.renalImpairment === "unknown" && c.labs?.egfr === undefined && (st.tags.has("age-65-plus") || c.medications.length > 0))
    push({ id: "fq:renal", priority: "medium", purpose: "medication", question: "Is renal function known (eGFR)?", reason: "Renal contraindication checks are limited while renal function is unknown.", systems: ["allopathy"] });
  if (wantsAllo && c.patient.hepaticImpairment === "unknown")
    push({ id: "fq:hepatic", priority: "low", purpose: "medication", question: "Any known liver disease?", reason: "Hepatic contraindication checks are limited while hepatic status is unknown.", systems: ["allopathy", "ayurveda"] });

  // --- diagnostic: unknown features of near-qualifying contexts
  for (const ctx of contexts.slice(0, 3)) {
    for (const f of ctx.features.filter((f) => f.status === "unknown")) {
      push({ id: `fq:ctx:${ctx.contextId}:${f.id}`, priority: ctx.qualifies ? "low" : "medium", purpose: "diagnostic", question: `${f.label}?`, reason: `Feature of "${ctx.label}" not yet recorded (${ctx.matched.length}/${ctx.total} features met).`, systems: ["allopathy"] });
    }
  }

  // --- characterisation of the chief complaint
  const chief = st.symptomDetail.get(c.complaint.chiefComplaintId) ?? c.complaint.symptoms[0];
  const chiefLabel = idx.symptom.get(chief?.conceptId ?? "")?.label ?? "the main complaint";
  if (chief) {
    if (!chief.durationValue) push({ id: "fq:duration", priority: "medium", purpose: "characterisation", question: `How long has ${chiefLabel.toLowerCase()} been present?`, reason: "Duration affects red-flag and context rules.", systems: ["shared"] });
    if (!chief.severity) push({ id: "fq:severity", priority: "medium", purpose: "characterisation", question: `How severe is ${chiefLabel.toLowerCase()} (mild / moderate / severe)?`, reason: "Severity is used by several rules.", systems: ["shared"] });
    if (!chief.aggravating.length && !chief.relieving.length) push({ id: "fq:modalities", priority: c.systems.includes("homeopathy") ? "high" : "low", purpose: "repertory", question: `What makes ${chiefLabel.toLowerCase()} better or worse?`, reason: "Modalities are central to repertory rubric selection and help characterise the complaint.", systems: ["homeopathy", "shared"] });
    if (!chief.sensation) push({ id: "fq:sensation", priority: "low", purpose: "characterisation", question: `Describe the character of ${chiefLabel.toLowerCase()} (e.g., throbbing, pressing, burning).`, reason: "Character is used by context features and repertory rubrics.", systems: ["allopathy", "homeopathy"] });
  }

  // --- system specific
  if (c.systems.includes("homeopathy")) {
    for (const h of idx.kb.homeopathyCaseTaking) {
      if (h.id === "hq_modalities" && chief && (chief.aggravating.length || chief.relieving.length)) continue;
      if (h.id === "hq_sensation" && chief?.sensation) continue;
      if (h.id === "hq_laterality" && chief?.laterality) continue;
      push({ id: `fq:${h.id}`, priority: h.priority === "high" ? "medium" : "low", purpose: "repertory", question: h.question, reason: "Classical homeopathic case-taking item.", systems: ["homeopathy"] });
    }
    if (!(c.homeopathy?.rubrics?.length)) push({ id: "fq:rubrics", priority: "medium", purpose: "repertory", question: "Confirm rubrics in the repertory selector (auto-suggested rubrics are provisional).", reason: "Repertorization quality depends on clinician-selected rubrics.", systems: ["homeopathy"] });
  }
  if (c.systems.includes("ayurveda")) {
    const ay = c.ayurveda;
    if (!ay || ay.agni === "not-assessed") push({ id: "fq:agni", priority: "medium", purpose: "ayurveda", question: "Assess agni (appetite, digestion after meals, bowel pattern): sama, vishama, tikshna or manda?", reason: "Agni status changes the Ayurvedic context match.", systems: ["ayurveda"] });
    if (!ay || ay.ama === "not-assessed") push({ id: "fq:ama", priority: "low", purpose: "ayurveda", question: "Signs of ama (coated tongue, heaviness, loss of taste, indigestion)?", reason: "Ama status changes the line of treatment in classical rationale.", systems: ["ayurveda"] });
    if (!ay || !ay.doshaObservations.length) push({ id: "fq:dosha", priority: "low", purpose: "ayurveda", question: "Record observed dosha features (clinician assessment).", reason: "Dosha observations mark items as supporting or needing review (traditional rationale; not a validated diagnostic test).", systems: ["ayurveda"] });
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  return q.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 14);
}
