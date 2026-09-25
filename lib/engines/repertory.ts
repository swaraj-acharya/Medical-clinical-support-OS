/**
 * Repertory operations over the full Repertorium Publicum pack (74,667 rubrics).
 * Repertorization = for each remedy, how many selected rubrics it appears in and the (weighted) sum of its grades.
 * Grades are the repertory's typographic emphasis (1–3), NOT probabilities or efficacy measures.
 */
import type { KnowledgeIndex } from "../knowledge/indexes";
import { getRepertory, parseRubricId, rubricNode, type RepertoryIndex, type RubricNode } from "../knowledge/store";
import { normalizeText } from "../normalize/text";
import type { PatientState } from "../safety/patient-state";
import { phraseMatches } from "./context";

export function chapters(r: RepertoryIndex = getRepertory()): RubricNode[] {
  return (r.children.get("") ?? []).map((id) => rubricNode(r, id)!).filter(Boolean);
}

export function childrenOf(parentPath: string | null, r: RepertoryIndex = getRepertory()): RubricNode[] {
  if (!parentPath) return chapters(r);
  return (r.children.get(parentPath) ?? []).map((id) => rubricNode(r, id)!).filter(Boolean);
}

export function getRubric(rubricId: string, r: RepertoryIndex = getRepertory()): RubricNode | null {
  const n = parseRubricId(rubricId);
  return n === null ? null : rubricNode(r, n);
}

/** Token search across all rubric paths. Every query token must occur in the path; shallower/shorter paths rank first. */
export function searchRubrics(q: string, opts: { limit?: number; chapter?: string } = {}, r: RepertoryIndex = getRepertory()): RubricNode[] {
  const toks = normalizeText(q).split(" ").filter((t) => t.length >= 2);
  if (!toks.length) return [];
  const chapter = opts.chapter ? normalizeText(opts.chapter) : null;
  const hits: { id: number; score: number }[] = [];
  for (const [id, p] of r.normPaths) {
    if (chapter && !p.startsWith(chapter + " ")) continue;
    if (!toks.every((t) => p.includes(t))) continue;
    const words = ` ${p} `;
    const whole = toks.filter((t) => words.includes(` ${t} `)).length;
    hits.push({ id, score: whole * 100 - p.length * 0.5 });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, opts.limit ?? 50).map((h) => rubricNode(r, h.id)!).filter(Boolean);
}

export interface RepertorizationRow {
  remedyId: string;
  oorepId: number;
  abbrev: string;
  name: string;
  covered: number;
  gradeSum: number;
  weightedScore: number;
  grades: Record<string, 0 | 1 | 2 | 3>;
}

export interface Repertorization {
  repertory: string;
  rubrics: (RubricNode & { weight: number })[];
  rows: RepertorizationRow[];
  unknownRubricIds: string[];
  method: string;
}

export const REPERTORIZATION_METHOD =
  "Totality-style repertorization: remedies are ranked by the number of selected rubrics they appear in (coverage), then by the weighted sum of repertory grades (grade 1–3 × clinician weight 1–3). This is a repertory cross-reference, not a probability of effectiveness.";

export function repertorize(selected: { rubricId: string; weight?: number }[], opts: { limit?: number } = {}, r: RepertoryIndex = getRepertory()): Repertorization {
  const rubrics: (RubricNode & { weight: number })[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const s of selected) {
    if (seen.has(s.rubricId)) continue;
    seen.add(s.rubricId);
    const n = getRubric(s.rubricId, r);
    if (!n) { unknown.push(s.rubricId); continue; }
    rubrics.push({ ...n, weight: Math.min(3, Math.max(1, Math.round(s.weight ?? 1))) });
  }
  const acc = new Map<number, RepertorizationRow>();
  for (const rb of rubrics) {
    for (const [remId, grade] of r.relations[String(rb.oorepId)] ?? []) {
      let row = acc.get(remId);
      if (!row) {
        const rem = r.remedies.get(remId);
        row = { remedyId: `rem_${remId}`, oorepId: remId, abbrev: rem?.abbrev ?? String(remId), name: rem?.name ?? String(remId), covered: 0, gradeSum: 0, weightedScore: 0, grades: {} };
        acc.set(remId, row);
      }
      row.covered += 1;
      row.gradeSum += grade;
      row.weightedScore += grade * rb.weight;
      row.grades[rb.id] = grade as 1 | 2 | 3;
    }
  }
  for (const row of acc.values()) for (const rb of rubrics) if (!(rb.id in row.grades)) row.grades[rb.id] = 0;
  const rows = [...acc.values()].sort((a, b) => b.covered - a.covered || b.weightedScore - a.weightedScore || b.gradeSum - a.gradeSum || a.abbrev.localeCompare(b.abbrev));
  return { repertory: String(r.meta.title ?? "Repertorium Publicum"), rubrics, rows: rows.slice(0, opts.limit ?? 30), unknownRubricIds: unknown, method: REPERTORIZATION_METHOD };
}

export interface SuggestedRubric { rubricId: string; path: string; reason: string; weight: number }

/** Maps structured symptom details to curated rubric hints. Suggestions only — the clinician confirms in the repertory selector. */
export function suggestRubrics(st: PatientState, idx: KnowledgeIndex, r: RepertoryIndex = getRepertory()): SuggestedRubric[] {
  const hints = idx.kb.homeopathyRubricHints;
  const out = new Map<string, SuggestedRubric>();
  const add = (path: string, reason: string, weight: number) => {
    const id = r.idByPath.get(path);
    if (id === undefined || out.has(path)) return;
    out.set(path, { rubricId: `pub_${id}`, path, reason, weight });
  };
  for (const sid of st.symptomsPresent) {
    const label = idx.symptom.get(sid)?.label ?? sid;
    const detail = st.symptomDetail.get(sid);
    let specific = 0;
    for (const m of hints.modifierRubrics.filter((x) => x.symptomId === sid)) {
      let hit = false;
      if (m.field === "concomitant") hit = m.match.some((s) => st.symptomsPresent.has(s));
      else if (!detail) hit = false;
      else if (m.field === "aggravating") hit = phraseMatches(detail.aggravating, m.match);
      else if (m.field === "relieving") hit = phraseMatches(detail.relieving, m.match);
      else {
        const v = (detail as Record<string, unknown>)[m.field];
        hit = typeof v === "string" && phraseMatches([v], m.match);
      }
      if (hit) {
        specific++;
        const modality = m.field === "aggravating" || m.field === "relieving";
        add(m.rubric, `${label}: ${m.field} matches "${m.match.join(" / ")}"`, modality ? 2 : 1);
      }
    }
    if (!specific) for (const p of hints.symptomRubrics[sid] ?? []) add(p, `${label} (general rubric)`, 1);
  }
  return [...out.values()];
}
