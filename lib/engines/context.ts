import type { ClinicalContext, FeaturePredicate } from "../../types/knowledge";
import type { ContextFeatureStatus, ContextMatch } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { normalizeText } from "../normalize/text";
import { evaluateRule } from "../safety/red-flags";
import { symptomDurationDays, type PatientState } from "../safety/patient-state";
import type { CaseInput } from "../validation/case-schema";

/** Phrase-level overlap in either direction: "walking up stairs" ~ "climbing stairs"? no; "movement" ~ "on movement" yes. */
export function phraseMatches(recorded: string[], terms: string[]): boolean {
  const rs = recorded.map(normalizeText).filter(Boolean);
  const ts = terms.map(normalizeText);
  return rs.some((r) => ts.some((t) => ` ${r} `.includes(` ${t} `) || ` ${t} `.includes(` ${r} `)));
}

export function evaluateFeature(p: FeaturePredicate, st: PatientState): ContextFeatureStatus["status"] {
  switch (p.kind) {
    case "symptom":
      return st.symptomsPresent.has(p.symptomId) ? "met" : "not-met";
    case "anySymptom":
      return p.symptomIds.some((s) => st.symptomsPresent.has(s)) ? "met" : "not-met";
    case "allSymptoms":
      return p.symptomIds.every((s) => st.symptomsPresent.has(s)) ? "met" : "not-met";
    case "absentSymptom":
      return st.symptomsPresent.has(p.symptomId) ? "not-met" : "met";
    case "detail": {
      const s = st.symptomDetail.get(p.symptomId);
      const v = s ? (s as Record<string, unknown>)[p.field] : undefined;
      if (typeof v !== "string" || !v || v === "not-applicable") return "unknown";
      return phraseMatches([v], p.anyOf) ? "met" : "not-met";
    }
    case "aggravatedBy":
    case "relievedBy": {
      const s = st.symptomDetail.get(p.symptomId);
      const list = p.kind === "aggravatedBy" ? s?.aggravating : s?.relieving;
      if (!list || list.length === 0) return "unknown";
      return phraseMatches(list, p.anyOf) ? "met" : "not-met";
    }
    case "notAggravatedBy": {
      const s = st.symptomDetail.get(p.symptomId);
      if (!s || s.aggravating.length === 0) return "unknown";
      return phraseMatches(s.aggravating, p.anyOf) ? "not-met" : "met";
    }
    case "durationDaysAtMost": {
      const d = symptomDurationDays(st.symptomDetail.get(p.symptomId));
      if (d === undefined) return "unknown";
      return d <= p.days ? "met" : "not-met";
    }
  }
}

/**
 * Matches the case against every curated clinical context (ICHD-3-style feature lists). A context "qualifies" when at
 * least `minimumFeatures` features are met. The score is the weighted share of features met — a transparency measure of
 * context fit, never a probability of disease.
 */
export function matchContexts(c: CaseInput, st: PatientState, idx: KnowledgeIndex): ContextMatch[] {
  const out: ContextMatch[] = [];
  for (const ctx of idx.kb.conditions as ClinicalContext[]) {
    if (!ctx.requires.some((s) => st.symptomsPresent.has(s))) continue;
    const features: ContextFeatureStatus[] = ctx.features.map((f) => ({ id: f.id, label: f.label, weight: f.weight, status: evaluateFeature(f.predicate, st) }));
    const total = features.reduce((a, f) => a + f.weight, 0);
    const got = features.filter((f) => f.status === "met").reduce((a, f) => a + f.weight, 0);
    const metCount = features.filter((f) => f.status === "met").length;
    const alarms = ctx.alarmFeatures.filter((a) => evaluateRule(a.when, c, st, idx).matched).map((a) => ({ id: a.id, text: a.text, sources: a.sources }));
    out.push({
      contextId: ctx.id, label: ctx.label, description: ctx.description, matched: features.filter((f) => f.status === "met").map((f) => f.label),
      total: features.length, score: total ? Math.round((got / total) * 100) / 100 : 0, qualifies: metCount >= ctx.minimumFeatures, minimumFeatures: ctx.minimumFeatures,
      features, alarms, guidelineIds: ctx.guidelineIds, codes: ctx.codes.map((x) => ({ system: x.system, code: x.code, display: x.display })), sources: ctx.sources,
    });
  }
  return out.sort((a, b) => Number(b.qualifies) - Number(a.qualifies) || b.score - a.score);
}
