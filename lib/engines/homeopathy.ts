import type { SourceRef } from "../../types/provenance";
import type { EvidenceLabel, HomeopathyCandidate, SafetyFinding, SystemResult, WhyItem } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { getMateriaMedica, getRepertory } from "../knowledge/store";
import type { PatientState } from "../safety/patient-state";
import type { CaseInput } from "../validation/case-schema";
import { REPERTORIZATION_METHOD, repertorize, suggestRubrics } from "./repertory";

export const HOMEOPATHY_FRAMING =
  "Repertory cross-reference only. Systematic reviews (e.g., NHMRC 2015) found no health condition with reliable evidence that homeopathy is effective; this is shown alongside the repertory result, not hidden. Homoeopathy is a legally recognised system of practice in India — recognition is not evidence of efficacy.";

const MAX_CANDIDATES = 10;
const CURATED: SourceRef = { sourceId: "cds-curated", reference: "Homeopathy safety disclosure rule" };

export function runHomeopathy(c: CaseInput, st: PatientState, idx: KnowledgeIndex): SystemResult<HomeopathyCandidate> {
  const kb = idx.kb;
  const rep = getRepertory();
  const result: SystemResult<HomeopathyCandidate> = {
    system: "homeopathy", methodology: REPERTORIZATION_METHOD, evidenceFraming: HOMEOPATHY_FRAMING, candidates: [], excluded: [], advisories: [], notFound: [], rubricsUsed: [],
  };
  const pubSource: SourceRef = { sourceId: "oorep", reference: `${String(rep.meta.title)} (${String(rep.meta.author ?? "")}, ${String(rep.meta.year ?? "")}) via OOREP`, url: "https://www.oorep.com/", version: String(rep.meta.edition ?? "") };

  const chosen = c.homeopathy?.rubrics ?? [];
  let selection: { rubricId: string; weight: number; origin: "clinician-selected" | "auto-suggested"; reason?: string }[];
  if (chosen.length) {
    selection = chosen.map((r) => ({ rubricId: r.rubricId, weight: r.weight ?? 1, origin: "clinician-selected" as const }));
  } else {
    selection = suggestRubrics(st, idx, rep).map((s) => ({ rubricId: s.rubricId, weight: s.weight, origin: "auto-suggested" as const, reason: s.reason }));
    if (selection.length) result.advisories.push({ kind: "note", text: "No rubrics were selected by the clinician. The rubrics below were auto-suggested from the structured symptom details using curated hints — confirm or replace them in the repertory selector before relying on the result.", sources: [CURATED] });
  }
  if (!selection.length) {
    result.notFound.push("No rubric could be selected or suggested from the entered symptoms. Use the repertory selector (chapter → rubric → sub-rubric) to choose rubrics.");
    return result;
  }
  const rp = repertorize(selection, { limit: 40 }, rep);
  for (const u of rp.unknownRubricIds) result.notFound.push(`Rubric ${u} not found in the current repertory.`);
  result.rubricsUsed = rp.rubrics.map((rb) => {
    const s = selection.find((x) => x.rubricId === rb.id)!;
    return { rubricId: rb.id, path: rb.path, weight: rb.weight, origin: s.origin, remedyCount: rb.remedyCount, reason: s.reason };
  });
  for (const e of kb.homeopathyEvidence) result.advisories.push({ kind: "evidence", text: e.summary, sources: [e.source] });
  result.advisories.push({ kind: "regulatory", text: kb.homeopathyRegulatory.text, sources: [kb.homeopathyRegulatory.source] });

  const toxic = new Map(kb.homeopathyToxicSources.filter((t) => t.remedyId).map((t) => [t.remedyId!, t]));
  const mm = getMateriaMedica();
  const nhmrc = kb.homeopathyEvidence.find((e) => e.category === "insufficient-evidence");
  const repRef = kb.homeopathyEvidence.find((e) => e.category === "repertory-reference");
  const minCover = rp.rubrics.length >= 3 ? 2 : 1;

  for (const row of rp.rows.filter((x) => x.covered >= minCover).slice(0, MAX_CANDIDATES)) {
    const findings: SafetyFinding[] = [];
    const tox = toxic.get(row.remedyId);
    if (tox) findings.push({ id: `tox:${row.remedyId}`, level: "warning", title: "Toxic source material", detail: `${tox.material}. ${tox.note}`, sources: tox.sources });
    if (st.tags.has("pregnant") || st.tags.has("breastfeeding")) findings.push({ id: `preg:${row.remedyId}`, level: "review", title: "Pregnancy/breastfeeding", detail: "No pregnancy/breastfeeding safety data are held for homeopathic preparations in this knowledge base; review product source material and potency.", sources: [CURATED] });
    if (st.tags.has("age-under-5")) findings.push({ id: `child:${row.remedyId}`, level: "review", title: "Young child", detail: "Young child: confirm preparation, potency and absence of toxic source material (see FDA 2017 belladonna teething-tablet findings).", sources: [CURATED] });
    const why: WhyItem[] = [
      { kind: "repertory", text: `Appears in ${row.covered} of ${rp.rubrics.length} selected rubrics; grade sum ${row.gradeSum}, weighted ${row.weightedScore}.`, sources: [pubSource] },
      ...rp.rubrics.filter((rb) => row.grades[rb.id] > 0).map((rb) => ({ kind: "repertory" as const, text: `${rb.path} — grade ${row.grades[rb.id]}${rb.weight > 1 ? ` (weight ×${rb.weight})` : ""}` })),
    ];
    const entry = mm.entries.get(row.oorepId);
    if (entry) why.push({ kind: "source", text: `Materia medica available for comparison: Boericke (1906) — sections ${entry.sections.slice(1).map((s) => s.heading).slice(0, 8).join(", ")}${entry.sections.length > 9 ? "…" : ""}`, sources: [{ sourceId: "oorep-boericke", reference: "Boericke, Pocket Manual of Homoeopathic Materia Medica (1906)" }] });
    const evidence: EvidenceLabel[] = [];
    if (repRef) evidence.push({ category: "repertory-reference", summary: repRef.summary, source: repRef.source });
    if (nhmrc) evidence.push({ category: "insufficient-evidence", summary: nhmrc.summary, source: nhmrc.source });
    result.candidates.push({
      id: `homeo:${row.remedyId}`, system: "homeopathy", entityId: row.remedyId, name: row.name, abbrev: row.abbrev,
      surfacedBecause: why, safety: findings, safetyStatus: findings.some((f) => f.level === "warning") ? "caution" : "no-conflict-in-entered-data",
      evidence, sources: [pubSource], lastVerified: String(rep.meta.importedAt ?? "unknown"),
      metric: { label: "Repertory match", rubricsCovered: row.covered, rubricsSelected: rp.rubrics.length, gradeSum: row.gradeSum, weightedScore: row.weightedScore, repertory: rp.repertory },
      rubricGrades: rp.rubrics.map((rb) => ({ rubricId: rb.id, path: rb.path, grade: row.grades[rb.id] ?? 0 })),
      materiaMedica: entry ? { source: "Boericke (1906)", headings: entry.sections.map((s) => s.heading) } : undefined,
    });
  }
  if (!result.candidates.length) result.notFound.push("No remedy appears in enough of the selected rubrics. Broaden or change rubric selection.");
  return result;
}
