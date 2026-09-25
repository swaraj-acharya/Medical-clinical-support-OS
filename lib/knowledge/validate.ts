import type { MasterKnowledge, RuleExpr } from "../../types/knowledge";
import type { SourceRegistryEntry } from "../../types/provenance";

export interface ValidationReport {
  generatedAt: string;
  knowledgeVersion: string;
  contentHash: string;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
  provenance: { entitiesChecked: number; withSources: number; coveragePercent: number; byVerification: Record<string, number> };
  sources: { referenced: string[]; unreferencedInRegistry: number; stale: string[]; unverifiedStatus: string[] };
}

/** Patient-state tags the safety engine can emit (lib/safety/patient-tags.ts). Drug rules must only use these. */
export const KNOWN_PATIENT_TAGS = new Set([
  "any", "pregnant", "pregnancy-20w-plus", "pregnancy-weeks-unknown", "pregnancy-status-unknown", "breastfeeding",
  "age-under-1", "age-under-5", "age-under-12", "age-under-16", "age-under-18", "age-55-plus", "age-65-plus",
  "renal-mild", "renal-moderate", "renal-severe", "hepatic-mild", "hepatic-moderate", "hepatic-severe",
  "thrombocytopenia", "dengue-risk", "uncontrolled-hypertension",
]);

const STALE_DAYS = 365;

function walkRule(e: RuleExpr, visit: (kind: "symptom" | "flag", id: string) => void) {
  if ("all" in e) e.all.forEach((x) => walkRule(x, visit));
  else if ("any" in e) e.any.forEach((x) => walkRule(x, visit));
  else if ("countAtLeast" in e) e.countAtLeast.of.forEach((x) => walkRule(x, visit));
  else if ("symptom" in e) visit("symptom", e.symptom);
  else if ("flag" in e) visit("flag", e.flag);
  else if ("detail" in e) visit("symptom", e.detail.symptomId);
  else if ("durationOver" in e) visit("symptom", e.durationOver.symptomId);
}

export function validateKnowledge(
  m: MasterKnowledge,
  opts: { registry: SourceRegistryEntry[]; rubricPaths?: Set<string> | Map<string, unknown>; now?: Date },
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = opts.now ?? new Date();
  const registryIds = new Set(opts.registry.map((s) => s.id));

  // ---- duplicate IDs per collection
  const collections: [string, { id: string }[]][] = [
    ["symptoms", m.symptoms], ["conditions", m.conditions], ["drugs", m.drugs], ["drugInteractions", m.drugInteractions],
    ["clinicalGuidelines", m.clinicalGuidelines], ["guidelineRecommendations", m.guidelineRecommendations], ["redFlags", m.redFlags],
    ["redFlagChecklist", m.redFlagChecklist], ["ayurvedicHerbs", m.ayurvedicHerbs], ["ayurvedicFormulations", m.ayurvedicFormulations],
    ["ayurvedicPrinciples", m.ayurvedicPrinciples], ["homeopathyRemedies", m.homeopathyRemedies], ["homeopathyRubrics", m.homeopathyRubrics],
    ["historyConditions", m.historyConditions], ["sources", m.sources],
  ];
  const counts: Record<string, number> = {};
  for (const [name, xs] of collections) {
    counts[name] = xs.length;
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x.id)) errors.push(`Duplicate id in ${name}: ${x.id}`);
      seen.add(x.id);
    }
  }
  counts.homeopathyRubricRemedyRelations = m.homeopathyRubricRemedyRelations.length;
  counts.terminologyMappings = m.terminologyMappings.length;
  counts.graphEdges = m.graphEdges.length;

  const symptomIds = new Set(m.symptoms.map((s) => s.id));
  const flagIds = new Set(m.redFlagChecklist.map((f) => f.id));
  const drugIds = new Set(m.drugs.map((d) => d.id));
  const ctxIds = new Set(m.conditions.map((c) => c.id));
  const glIds = new Set(m.clinicalGuidelines.map((g) => g.id));
  const herbIds = new Set(m.ayurvedicHerbs.map((h) => h.id));
  const principleIds = new Set(m.ayurvedicPrinciples.map((p) => p.id));
  const classTags = new Set([...m.drugs.flatMap((d) => d.classTags), ...(m.drugClassLexicon ?? []).map((c) => c.classTag)]);
  const bodySystemIds = new Set(m.bodySystems.map((b) => b.id));
  const conditionTags = new Set(m.historyConditions.flatMap((h) => h.tags));

  // ---- referential integrity
  for (const s of m.symptoms) if (!bodySystemIds.has(s.bodySystem)) errors.push(`Symptom ${s.id} has unknown bodySystem ${s.bodySystem}`);
  for (const c of m.conditions) {
    for (const r of c.requires) if (!symptomIds.has(r)) errors.push(`Context ${c.id} requires unknown symptom ${r}`);
    for (const g of c.guidelineIds) if (!glIds.has(g)) errors.push(`Context ${c.id} references unknown guideline ${g}`);
    for (const f of c.features) {
      const p = f.predicate as { symptomId?: string; symptomIds?: string[] };
      for (const sid of p.symptomIds ?? (p.symptomId ? [p.symptomId] : [])) if (!symptomIds.has(sid)) errors.push(`Context ${c.id} feature ${f.id} references unknown symptom ${sid}`);
    }
    for (const a of c.alarmFeatures) walkRule(a.when, (k, id) => { if (k === "symptom" && !symptomIds.has(id)) errors.push(`Alarm ${a.id} references unknown symptom ${id}`); });
    if (c.minimumFeatures > c.features.length) errors.push(`Context ${c.id} minimumFeatures exceeds feature count`);
  }
  for (const r of m.guidelineRecommendations) {
    if (!ctxIds.has(r.contextId)) errors.push(`Recommendation ${r.id} references unknown context ${r.contextId}`);
    if (!glIds.has(r.guidelineId)) errors.push(`Recommendation ${r.id} references unknown guideline ${r.guidelineId}`);
    for (const d of r.drugIds) if (!drugIds.has(d)) errors.push(`Recommendation ${r.id} references unknown drug ${d}`);
  }
  const resolvesDrug = (x: string) => (x.startsWith("class:") ? classTags.has(x.slice(6)) : drugIds.has(x));
  for (const i of m.drugInteractions) {
    if (!resolvesDrug(i.a)) errors.push(`Interaction ${i.id}: '${i.a}' does not resolve to a drug or class`);
    if (!resolvesDrug(i.b)) errors.push(`Interaction ${i.id}: '${i.b}' does not resolve to a drug or class`);
  }
  for (const d of m.drugs) {
    for (const r of [...d.contraindications, ...d.warnings]) for (const t of r.when) {
      const ok = KNOWN_PATIENT_TAGS.has(t) || conditionTags.has(t) || t.startsWith("allergy:") || t.startsWith("on:");
      if (!ok) errors.push(`Drug ${d.id} rule ${r.id} uses tag '${t}' that no patient state can produce`);
    }
    if (!d.rxcui) warnings.push(`Drug ${d.id} has no RXCUI`);
    if (d.verification === "curated-pending-verification") { /* expected for seed data — summarised below */ }
  }
  for (const r of m.redFlags) walkRule(r.when, (k, id) => {
    if (k === "symptom" && !symptomIds.has(id)) errors.push(`Red flag ${r.id} references unknown symptom ${id}`);
    if (k === "flag" && !flagIds.has(id)) errors.push(`Red flag ${r.id} references unknown checklist flag ${id}`);
  });
  for (const f of m.redFlagChecklist) for (const s of f.appliesTo) if (!symptomIds.has(s)) errors.push(`Checklist ${f.id} applies to unknown symptom ${s}`);
  for (const t of m.ayurvedicIndications) for (const s of t.symptomIds) if (!symptomIds.has(s)) errors.push(`Ayurveda term ${t.term} maps to unknown symptom ${s}`);
  for (const t of m.ayurvedicIndications) if (t.symptomIds.length === 0) warnings.push(`Ayurveda term '${t.term}' has no symptom correlate (kept for search only)`);
  for (const f of m.ayurvedicFormulations) for (const h of f.ingredientHerbIds) if (!herbIds.has(h)) errors.push(`Formulation ${f.id} references unknown herb ${h}`);
  for (const h of m.ayurvedicSafety.herbSafety) if (!herbIds.has(h.herbId)) errors.push(`Herb safety references unknown herb ${h.herbId}`);
  const rules = m.ayurvedicRules;
  for (const grp of [rules.doshaSupport, rules.agni, rules.ama]) for (const [k, v] of Object.entries(grp)) for (const p of v.principleIds) if (!principleIds.has(p)) errors.push(`Ayurveda rule ${k} references unknown principle ${p}`);
  for (const sid of Object.keys(m.homeopathyRubricHints.symptomRubrics)) if (!symptomIds.has(sid)) errors.push(`Rubric hint for unknown symptom ${sid}`);
  if (opts.rubricPaths) {
    const all = [...Object.values(m.homeopathyRubricHints.symptomRubrics).flat(), ...m.homeopathyRubricHints.modifierRubrics.map((x) => x.rubric)];
    for (const p of all) if (!opts.rubricPaths.has(p)) errors.push(`Rubric hint path not found in repertory: '${p}'`);
  }
  for (const t of m.homeopathyToxicSources) if (!t.remedyId) warnings.push(`Toxic-source abbreviation ${t.abbrev} not found in repertory`);

  // ---- provenance / sources
  const referenced = new Set<string>();
  const addRef = (sid: string | undefined, where: string) => {
    if (!sid) return;
    referenced.add(sid);
    if (!registryIds.has(sid)) errors.push(`Unknown sourceId '${sid}' referenced by ${where}`);
  };
  const provenanced: { id: string; sources?: { sourceId: string }[]; verification?: string }[] = [
    ...m.symptoms, ...m.conditions, ...m.drugs, ...m.drugInteractions, ...m.guidelineRecommendations, ...m.redFlags,
    ...m.ayurvedicHerbs, ...m.ayurvedicFormulations, ...m.ayurvedicPrinciples, ...(m.drugClassLexicon ?? []).map((c) => ({ ...c, id: `lex_${c.classTag}` })),
  ];
  const byVerification: Record<string, number> = {};
  let withSources = 0;
  for (const e of provenanced) {
    const n = e.sources?.length ?? 0;
    if (n > 0) withSources++; else errors.push(`Entity ${e.id} has no sources`);
    for (const s of e.sources ?? []) addRef(s.sourceId, e.id);
    const v = e.verification ?? "missing";
    byVerification[v] = (byVerification[v] ?? 0) + 1;
    if (v === "missing") errors.push(`Entity ${e.id} has no verification status`);
  }
  for (const d of m.drugs) for (const r of [...d.contraindications, ...d.warnings]) addRef(r.source.sourceId, `${d.id}/${r.id}`);
  for (const g of m.clinicalGuidelines) addRef(g.sourceId, g.id);
  for (const x of m.homeopathyEvidence) addRef(x.source.sourceId, "homeopathyEvidence");
  for (const x of m.homeopathyToxicSources) x.sources.forEach((s) => addRef(s.sourceId, `toxic ${x.abbrev}`));
  for (const x of m.clinicalStudies) addRef(x.sourceId, x.id);
  for (const x of m.graphEdges) if (!registryIds.has(x.sourceId)) errors.push(`Graph edge ${x.from}→${x.to} has unknown sourceId ${x.sourceId}`);

  const pending = byVerification["curated-pending-verification"] ?? 0;
  if (pending) warnings.push(`${pending} curated entities are 'curated-pending-verification' (require verification before clinical use)`);

  const stale: string[] = [];
  const unverifiedStatus: string[] = [];
  for (const s of opts.registry) {
    const age = (now.getTime() - new Date(s.lastChecked).getTime()) / 86400000;
    if (age > STALE_DAYS) stale.push(s.id);
    if (s.status === "unverified") unverifiedStatus.push(s.id);
  }
  if (stale.length) warnings.push(`${stale.length} source(s) not re-checked in ${STALE_DAYS} days: ${stale.join(", ")}`);

  return {
    generatedAt: now.toISOString(),
    knowledgeVersion: m.metadata.version,
    contentHash: m.metadata.contentHash,
    counts,
    errors,
    warnings,
    provenance: { entitiesChecked: provenanced.length, withSources, coveragePercent: provenanced.length ? Math.round((withSources / provenanced.length) * 1000) / 10 : 0, byVerification },
    sources: { referenced: [...referenced].sort(), unreferencedInRegistry: [...registryIds].filter((x) => !referenced.has(x)).length, stale, unverifiedStatus },
  };
}
