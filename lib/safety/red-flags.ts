import type { RedFlagRule, RuleExpr } from "../../types/knowledge";
import type { RedFlagResult, SafetyFinding } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { normalizeText } from "../normalize/text";
import type { CaseInput } from "../validation/case-schema";
import { symptomDurationDays, type PatientState } from "./patient-state";

export interface RuleEval { matched: boolean; facts: string[]; missingVitals: string[] }

const VITAL_LABEL: Record<string, string> = {
  temperatureC: "Temperature (°C)", heartRate: "Heart rate", respiratoryRate: "Respiratory rate", systolicBP: "Systolic BP",
  diastolicBP: "Diastolic BP", spo2: "SpO₂", gcs: "GCS",
};

function cmp(a: number, op: "<" | "<=" | ">" | ">=", b: number) {
  return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
}

/**
 * Evaluates a rule expression over the case. Returns the facts that made it true (for the "why" display) and the
 * vital signs that were referenced but not recorded (they become high-priority follow-up questions).
 */
export function evaluateRule(e: RuleExpr, c: CaseInput, st: PatientState, idx: KnowledgeIndex): RuleEval {
  const label = (id: string) => idx.symptom.get(id)?.label ?? id;
  if ("all" in e) {
    const parts = e.all.map((x) => evaluateRule(x, c, st, idx));
    return { matched: parts.every((p) => p.matched), facts: parts.flatMap((p) => p.facts), missingVitals: parts.flatMap((p) => p.missingVitals) };
  }
  if ("any" in e) {
    const parts = e.any.map((x) => evaluateRule(x, c, st, idx));
    const hit = parts.filter((p) => p.matched);
    return { matched: hit.length > 0, facts: hit.flatMap((p) => p.facts), missingVitals: parts.flatMap((p) => p.missingVitals) };
  }
  if ("countAtLeast" in e) {
    const parts = e.countAtLeast.of.map((x) => evaluateRule(x, c, st, idx));
    const hit = parts.filter((p) => p.matched);
    return { matched: hit.length >= e.countAtLeast.n, facts: hit.flatMap((p) => p.facts), missingVitals: parts.flatMap((p) => p.missingVitals) };
  }
  if ("symptom" in e) {
    const m = st.symptomsPresent.has(e.symptom);
    return { matched: m, facts: m ? [`${label(e.symptom)} present`] : [], missingVitals: [] };
  }
  if ("flag" in e) {
    const m = st.flags.has(e.flag);
    const f = idx.kb.redFlagChecklist.find((x) => x.id === e.flag);
    return { matched: m, facts: m ? [`Checklist: ${f?.label ?? e.flag}`] : [], missingVitals: [] };
  }
  if ("detail" in e) {
    const s = st.symptomDetail.get(e.detail.symptomId);
    const raw = s ? (s as Record<string, unknown>)[e.detail.field] : undefined;
    const v = typeof raw === "string" ? normalizeText(raw) : "";
    const m = Boolean(v) && e.detail.anyOf.some((a) => v === normalizeText(a) || ` ${v} `.includes(` ${normalizeText(a)} `));
    return { matched: m, facts: m ? [`${label(e.detail.symptomId)}: ${e.detail.field} = ${raw}`] : [], missingVitals: [] };
  }
  if ("vital" in e) {
    const v = c.vitals?.[e.vital.name];
    if (v === undefined) return { matched: false, facts: [], missingVitals: [e.vital.name] };
    const m = cmp(v, e.vital.op, e.vital.value);
    return { matched: m, facts: m ? [`${VITAL_LABEL[e.vital.name]} ${v} (${e.vital.op} ${e.vital.value})`] : [], missingVitals: [] };
  }
  if ("ageYears" in e) {
    const m = cmp(c.patient.ageYears, e.ageYears.op, e.ageYears.value);
    return { matched: m, facts: m ? [`Age ${c.patient.ageYears} years`] : [], missingVitals: [] };
  }
  if ("pregnant" in e) {
    const m = st.tags.has("pregnant");
    return { matched: m, facts: m ? ["Pregnant"] : [], missingVitals: [] };
  }
  if ("durationOver" in e) {
    const days = symptomDurationDays(st.symptomDetail.get(e.durationOver.symptomId));
    const m = days !== undefined && days > e.durationOver.days;
    return { matched: m, facts: m ? [`${label(e.durationOver.symptomId)} for ${Math.round(days!)} days (> ${e.durationOver.days})`] : [], missingVitals: [] };
  }
  return { matched: false, facts: [], missingVitals: [] };
}

function appliesToPopulation(r: RedFlagRule, c: CaseInput, st: PatientState) {
  if (r.population === "adult") return c.patient.ageYears >= 16;
  if (r.population === "paediatric") return c.patient.ageYears < 18;
  if (r.population === "pregnancy") return st.tags.has("pregnant");
  return true;
}

/**
 * Safety / red-flag engine. Runs before any system engine.
 *  - any EMERGENCY rule → status "emergency", blocked = true (no treatment candidates are generated)
 *  - any URGENT rule    → status "urgent", candidates withheld until a clinician acknowledgement is recorded
 */
export function evaluateRedFlags(c: CaseInput, st: PatientState, idx: KnowledgeIndex): RedFlagResult & { missingVitals: string[] } {
  const findings: SafetyFinding[] = [];
  const missing = new Set<string>();
  let checked = 0;
  for (const r of idx.kb.redFlags) {
    if (!appliesToPopulation(r, c, st)) continue;
    checked++;
    const ev = evaluateRule(r.when, c, st, idx);
    ev.missingVitals.forEach((v) => missing.add(v));
    if (ev.matched) {
      findings.push({ id: `rf:${r.id}`, ruleId: r.id, level: r.severity === "emergency" ? "emergency" : "high-risk", title: r.title, detail: r.guidance, matchedFacts: [...new Set(ev.facts)], sources: r.sources });
    }
  }
  const emergency = findings.some((f) => f.level === "emergency");
  const urgent = !emergency && findings.length > 0;
  return {
    status: emergency ? "emergency" : urgent ? "urgent" : "clear",
    blocked: emergency,
    findings: findings.sort((a, b) => (a.level === "emergency" ? 0 : 1) - (b.level === "emergency" ? 0 : 1)),
    checkedRuleCount: checked,
    note: emergency
      ? "Emergency red flag(s) detected. Treatment candidates are not generated. Arrange emergency assessment/referral now."
      : urgent
        ? "Urgent red flag(s) detected. Candidates are withheld until a clinician records that the red flag has been assessed."
        : `No red-flag rule matched the entered data (${checked} rules checked). This does not exclude serious illness — absence of data is not absence of risk.`,
    missingVitals: [...missing],
  };
}
