/**
 * Analysis pipeline (Deterministic Mode). Order matters:
 *   1. normalise case → patient-state tags   2. SAFETY / RED-FLAG ENGINE (can withhold everything)
 *   3. clinical-context matching             4. follow-up questions
 *   5. system engines — allopathy, ayurveda, homeopathy — each separate, sharing only the case model and safety state
 * No step calls an LLM. Every candidate carries its sources and the knowledge-base version.
 */
import { randomUUID } from "node:crypto";
import type { AnalysisResult, Candidate, SystemResult } from "../../types/recommendation";
import type { SourceRef } from "../../types/provenance";
import { buildIndex, type KnowledgeIndex } from "../knowledge/indexes";
import { getKnowledge } from "../knowledge/store";
import { derivePatientState } from "../safety/patient-state";
import { evaluateRedFlags } from "../safety/red-flags";
import { reviewCurrentRegimen } from "../safety/medication";
import type { CaseInput } from "../validation/case-schema";
import { runAllopathy } from "./allopathy";
import { runAyurveda } from "./ayurveda";
import { matchContexts } from "./context";
import { followUpQuestions } from "./followup";
import { runHomeopathy } from "./homeopathy";

export interface Acknowledgement { ruleIds: string[]; clinicianRef: string; reason: string; at: string }

export function analyzeCase(
  input: CaseInput,
  opts: { caseId: string; acknowledgement?: Acknowledgement; idx?: KnowledgeIndex; aiAssisted?: boolean; now?: Date },
): AnalysisResult {
  const idx = opts.idx ?? buildIndex(getKnowledge());
  const kb = idx.kb;
  const st = derivePatientState(input, idx);
  const rf = evaluateRedFlags(input, st, idx);
  const contexts = matchContexts(input, st, idx);
  const followUp = followUpQuestions(input, st, idx, rf, contexts);

  const urgentIds = rf.findings.filter((f) => f.level !== "emergency").map((f) => f.ruleId!).filter(Boolean);
  const ackCovers = Boolean(opts.acknowledgement) && urgentIds.every((id) => opts.acknowledgement!.ruleIds.includes(id));
  let withheldReason: string | undefined;
  if (rf.status === "emergency") withheldReason = "Emergency red flag present — candidate generation is blocked. Arrange emergency assessment.";
  else if (rf.status === "urgent" && !ackCovers) withheldReason = "Urgent red flag present — candidates are withheld until a clinician records that the red flag has been assessed (acknowledgement is audit-logged).";

  const chief = input.complaint.chiefComplaintId;
  const roles = new Map<string, "chief" | "presenting" | "associated">();
  for (const s of input.complaint.symptoms) roles.set(s.conceptId, s.conceptId === chief ? "chief" : "presenting");
  for (const s of input.complaint.associatedSymptomIds) if (!roles.has(s)) roles.set(s, "associated");
  if (!roles.has(chief)) roles.set(chief, "chief");

  const result: AnalysisResult = {
    analysisId: `an_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    caseId: opts.caseId,
    createdAt: (opts.now ?? new Date()).toISOString(),
    knowledgeBaseVersion: kb.metadata.version,
    knowledgeContentHash: kb.metadata.contentHash,
    mode: opts.aiAssisted ? "deterministic+ai-extraction" : "deterministic",
    redFlags: rf,
    candidatesWithheld: Boolean(withheldReason),
    withheldReason,
    acknowledgement: rf.status === "urgent" && ackCovers ? opts.acknowledgement : undefined,
    normalizedSymptoms: [...roles.entries()].map(([id, role]) => ({ conceptId: id, label: idx.symptom.get(id)?.label ?? `Unknown concept ${id}`, role, bodySystem: idx.symptom.get(id)?.bodySystem ?? "unknown" })),
    medicationNormalization: st.meds.map((m) => ({ input: m.input, drugIds: m.drugIds, classTags: m.classTags, via: m.via, note: m.note })),
    regimenReview: reviewCurrentRegimen(st, idx),
    allergyNormalization: st.allergies.map((a) => ({ substance: a.substance, tags: a.tags, recognised: a.recognised, note: a.note })),
    patientTags: [...st.tags].filter((t) => t !== "any").sort(),
    patientTagDerivations: st.derivations,
    contexts,
    followUp,
    conflicts: [],
    sourcesUsed: [],
  };

  if (!withheldReason) {
    if (input.systems.includes("allopathy")) {
      result.allopathy = runAllopathy(st, idx, contexts);
      if (!result.allopathy.candidates.length && result.allopathy.excluded.length)
        result.allopathy.notFound.push("Every guideline-linked medicine for the matched context was excluded by the safety checks for this patient. Clinician judgement and specialist/pharmacist input are required; the tool does not propose substitutes outside its knowledge base.");
    }
    if (input.systems.includes("ayurveda")) result.ayurveda = runAyurveda(input, st, idx);
    if (input.systems.includes("homeopathy")) result.homeopathy = runHomeopathy(input, st, idx);
  }

  // Conflict detection: sources that disagree are displayed, never silently resolved.
  const ixConflicts = new Map<string, { topic: string; detail: string; sources: SourceRef[] }>();
  for (const cand of result.allopathy?.candidates ?? []) {
    for (const f of cand.safety) {
      if (f.ruleId && /conflicting/i.test(f.detail) && f.sources.length > 1) ixConflicts.set(f.ruleId, { topic: `${f.title} — ${cand.name}`, detail: f.detail, sources: f.sources });
    }
  }
  result.conflicts.push(...ixConflicts.values());
  if (result.homeopathy) {
    const ev = kb.homeopathyEvidence.filter((e) => e.category === "insufficient-evidence" || e.category === "conflicting-evidence");
    if (ev.length > 1) result.conflicts.push({ topic: "Homeopathy evidence", detail: ev.map((e) => e.summary).join(" "), sources: ev.map((e) => e.source) });
  }
  const sids = new Set<string>();
  const addSrc = (xs?: SourceRef[]) => xs?.forEach((s) => sids.add(s.sourceId));
  rf.findings.forEach((f) => addSrc(f.sources));
  result.regimenReview.forEach((f) => addSrc(f.sources));
  contexts.forEach((c) => addSrc(c.sources));
  for (const sys of [result.allopathy, result.ayurveda, result.homeopathy] as (SystemResult<Candidate> | undefined)[]) {
    if (!sys) continue;
    sys.advisories.forEach((a) => addSrc(a.sources));
    for (const c of sys.candidates) { addSrc(c.sources); c.safety.forEach((f) => addSrc(f.sources)); c.surfacedBecause.forEach((w) => addSrc(w.sources)); }
  }
  result.sourcesUsed = [...sids].sort();
  return result;
}
