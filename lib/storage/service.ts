/** Application service: the only place that combines storage, the analysis pipeline and the audit log. */
import type { AnalysisResult, Candidate } from "../../types/recommendation";
import { analyzeCase } from "../engines/analyze";
import { buildIndex } from "../knowledge/indexes";
import { getKnowledge } from "../knowledge/store";
import type { CaseInput, DecisionInput } from "../validation/case-schema";
import { appendAudit } from "./audit";
import { ConflictError, createCase, getAnalysis, getCase, NotFoundError, saveAnalysis, updateCase, type CaseRecord, type DecisionRecord } from "./cases";
import { newId } from "./runtime";

const kbMeta = () => { const k = getKnowledge(); return { kbVersion: k.metadata.version, kbContentHash: k.metadata.contentHash }; };

export async function createCaseAudited(input: CaseInput, actor: string, demoKey?: string): Promise<CaseRecord> {
  const rec = await createCase(input, demoKey);
  await appendAudit({ event: "case.created", caseId: rec.id, actor, ...kbMeta(), payload: { inputs: input, demoKey: demoKey ?? null } });
  return rec;
}

function allCandidates(a: AnalysisResult): Candidate[] {
  return [...(a.allopathy?.candidates ?? []), ...(a.ayurveda?.candidates ?? []), ...(a.homeopathy?.candidates ?? [])];
}

export async function runAnalysisAudited(caseId: string, actor: string, opts: { aiAssisted?: boolean } = {}): Promise<AnalysisResult> {
  const c = getCase(caseId);
  const ack = c.acknowledgements.at(-1);
  const result = analyzeCase(c.input, { caseId, acknowledgement: ack, idx: buildIndex(getKnowledge()), aiAssisted: opts.aiAssisted });
  saveAnalysis(result);
  await updateCase(caseId, (rec) => {
    rec.analyses.push({
      analysisId: result.analysisId, createdAt: result.createdAt, kbVersion: result.knowledgeBaseVersion, redFlagStatus: result.redFlags.status, withheld: result.candidatesWithheld,
      candidateCounts: { allopathy: result.allopathy?.candidates.length ?? 0, ayurveda: result.ayurveda?.candidates.length ?? 0, homeopathy: result.homeopathy?.candidates.length ?? 0 },
    });
  });
  await appendAudit({
    event: "analysis.run", caseId, analysisId: result.analysisId, actor, kbVersion: result.knowledgeBaseVersion, kbContentHash: result.knowledgeContentHash,
    payload: {
      mode: result.mode,
      inputs: c.input,
      normalizedSymptoms: result.normalizedSymptoms,
      patientTags: result.patientTags,
      medicationNormalization: result.medicationNormalization,
      redFlags: { status: result.redFlags.status, ruleIds: result.redFlags.findings.map((f) => f.ruleId) },
      candidatesWithheld: result.candidatesWithheld,
      acknowledgement: result.acknowledgement ?? null,
      contexts: result.contexts.filter((x) => x.qualifies).map((x) => x.contextId),
      rubricsUsed: result.homeopathy?.rubricsUsed ?? [],
      candidates: allCandidates(result).map((x) => ({ id: x.id, name: x.name, safetyStatus: x.safetyStatus, safetyFindingIds: x.safety.map((f) => f.id) })),
      excluded: [...(result.allopathy?.excluded ?? []), ...(result.ayurveda?.excluded ?? []), ...(result.homeopathy?.excluded ?? [])],
      sourcesUsed: result.sourcesUsed,
    },
  });
  return result;
}

export async function acknowledgeAudited(caseId: string, ack: { acknowledgedRuleIds: string[]; clinicianRef: string; reason: string }, actor: string) {
  const c = getCase(caseId);
  const last = c.analyses.at(-1);
  if (!last) throw new ConflictError("Run an analysis before acknowledging red flags");
  const a = getAnalysis(last.analysisId);
  if (a.redFlags.status === "emergency") throw new ConflictError("Emergency red flags cannot be acknowledged to unlock candidates.");
  const urgent = a.redFlags.findings.map((f) => f.ruleId!).filter(Boolean);
  const unknown = ack.acknowledgedRuleIds.filter((id) => !urgent.includes(id));
  if (unknown.length) throw new ConflictError(`Rule(s) not present in the latest analysis: ${unknown.join(", ")}`);
  if (!urgent.length) throw new ConflictError("The latest analysis has no urgent red flag to acknowledge.");
  const entry = { ruleIds: ack.acknowledgedRuleIds, clinicianRef: ack.clinicianRef, reason: ack.reason, at: new Date().toISOString() };
  await updateCase(caseId, (rec) => { rec.acknowledgements.push(entry); });
  await appendAudit({ event: "redflag.acknowledged", caseId, analysisId: a.analysisId, actor, ...kbMeta(), payload: entry });
  return entry;
}

export async function recordDecisionAudited(caseId: string, analysisId: string, d: DecisionInput, actor: string): Promise<DecisionRecord> {
  const c = getCase(caseId);
  if (!c.analyses.some((x) => x.analysisId === analysisId)) throw new NotFoundError("Analysis does not belong to this case");
  const a = getAnalysis(analysisId);
  const cand = allCandidates(a).find((x) => x.id === d.candidateId);
  const excl = [...(a.allopathy?.excluded ?? []), ...(a.ayurveda?.excluded ?? []), ...(a.homeopathy?.excluded ?? [])].find((x) => d.candidateId.endsWith(x.entityId));
  if (!cand && !excl) throw new NotFoundError("Candidate not found in this analysis");
  if (cand && cand.system !== d.system) throw new ConflictError(`Candidate belongs to ${cand.system}, not ${d.system}`);
  const rec: DecisionRecord = { ...d, id: newId("dec"), at: new Date().toISOString(), analysisId, candidateName: cand?.name ?? excl!.name, kbVersion: a.knowledgeBaseVersion };
  await updateCase(caseId, (x) => { x.decisions.push(rec); });
  await appendAudit({ event: "decision.recorded", caseId, analysisId, actor, kbVersion: a.knowledgeBaseVersion, kbContentHash: a.knowledgeContentHash, payload: rec });
  return rec;
}
