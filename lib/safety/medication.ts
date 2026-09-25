import type { Drug, DrugInteraction } from "../../types/knowledge";
import type { SafetyFinding } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { normalizeText } from "../normalize/text";
import type { PatientState } from "./patient-state";

export interface DrugSafetyResult {
  findings: SafetyFinding[];
  status: "no-conflict-in-entered-data" | "caution" | "excluded";
  exclusionReasons: string[];
}

const CURATED = { sourceId: "cds-curated", reference: "Medication safety rule (application logic)" };
/** Classes where taking two members together is flagged as therapeutic duplication. */
const DUPLICATION_CLASSES: Record<string, "exclude" | "caution"> = {
  nsaid: "exclude", ppi: "caution", triptan: "caution", ssri: "caution", anticoagulant: "exclude", "antihistamine-h1": "caution", penicillin: "caution", paracetamol: "exclude",
};
const PREGNANCY_TAGS = ["pregnant", "pregnancy-20w-plus", "pregnancy-weeks-unknown"];

export function interactionSideMatchesDrug(x: string, d: Drug) {
  return x === d.id || (x.startsWith("class:") && d.classTags.includes(x.slice(6)));
}

function medsMatching(x: string, st: PatientState, exceptDrugId: string) {
  return st.meds.filter((m) => {
    if (x.startsWith("class:")) return m.classTags.includes(x.slice(6)) && !(m.drugIds.length === 1 && m.drugIds[0] === exceptDrugId);
    return m.drugIds.includes(x) && x !== exceptDrugId;
  });
}

export function checkDrugSafety(d: Drug, st: PatientState, idx: KnowledgeIndex): DrugSafetyResult {
  const findings: SafetyFinding[] = [];
  const excluded: string[] = [];

  // 1. Allergy / hypersensitivity (direct drug, ingredient, class)
  const keys = [d.id, normalizeText(d.name), ...d.classTags, ...d.composition.map((c) => normalizeText(c.name)), ...d.synonyms.map(normalizeText)].map((k) => `allergy:${k}`);
  for (const a of st.allergies) {
    const hit = a.tags.find((t) => keys.includes(t));
    if (hit) {
      const txt = `Recorded allergy/intolerance to '${a.substance}' (${hit.replace("allergy:", "")}) — ${d.name} matches.`;
      findings.push({ id: `allergy:${d.id}:${hit}`, level: "high-risk", title: "Allergy conflict", detail: txt, matchedFacts: [a.substance], sources: [CURATED] });
      excluded.push(txt);
    }
  }

  // 2. Contraindications and warnings (drug–disease, age, pregnancy, breastfeeding, renal, hepatic)
  for (const r of [...d.contraindications, ...d.warnings]) {
    const hit = r.when.filter((t) => t === "any" || st.tags.has(t));
    if (!hit.length) continue;
    const level = r.severity === "contraindicated" || r.severity === "avoid" ? "high-risk" : r.severity === "caution" ? "warning" : "info";
    const title = r.severity === "contraindicated" ? "Contraindication" : r.severity === "avoid" ? "Avoid" : r.severity === "caution" ? "Caution" : "Monitor";
    findings.push({ id: `rule:${d.id}:${r.id}`, ruleId: r.id, level, title, detail: r.text, matchedFacts: hit.filter((t) => t !== "any"), sources: [r.source] });
    if (level === "high-risk") excluded.push(`${title}: ${r.text}`);
  }

  // 3. Drug–drug interactions with current medications (drug ids or class-level rules)
  for (const i of idx.kb.drugInteractions as DrugInteraction[]) {
    let partners: string[] = [];
    if (interactionSideMatchesDrug(i.a, d)) partners = medsMatching(i.b, st, d.id).map((m) => m.input);
    if (!partners.length && interactionSideMatchesDrug(i.b, d)) partners = medsMatching(i.a, st, d.id).map((m) => m.input);
    if (!partners.length) continue;
    const level = i.severity === "minor" ? "info" : "interaction";
    const detail = `${i.effect} Management: ${i.management}`;
    findings.push({ id: `ix:${d.id}:${i.id}`, ruleId: i.id, level, title: `Interaction (${i.severity}) with ${partners.join(", ")}`, detail, matchedFacts: partners, sources: i.sources });
    if (i.severity === "contraindicated" || i.severity === "major") excluded.push(`${i.severity === "major" ? "Major" : "Contraindicated"} interaction with ${partners.join(", ")}: ${i.effect}`);
  }

  // 4. Duplicate therapy (same ingredient incl. inside fixed-dose combinations, or same class)
  const ingredients = d.composition.map((c) => normalizeText(c.name));
  const sameIngredient = st.meds.filter((m) => m.drugIds.includes(d.id) || m.ingredients.some((x) => ingredients.includes(normalizeText(x))));
  if (sameIngredient.length) {
    const txt = `Already taking ${sameIngredient.map((m) => m.input).join(", ")} which contains ${d.composition.map((c) => c.name).join(" + ")} — duplicate therapy.`;
    findings.push({ id: `dup:${d.id}`, level: "high-risk", title: "Duplicate therapy (same ingredient)", detail: txt, matchedFacts: sameIngredient.map((m) => m.input), sources: [CURATED] });
    excluded.push(txt);
  } else {
    for (const cls of d.classTags) {
      const mode = DUPLICATION_CLASSES[cls];
      if (!mode) continue;
      let others = st.meds.filter((m) => m.classTags.includes(cls));
      if (cls === "nsaid") others = others.filter((m) => !(m.drugIds.length === 1 && m.drugIds[0] === "drug_aspirin"));
      if (!others.length) continue;
      const txt = `Already taking ${others.map((m) => m.input).join(", ")} (${cls}) — therapeutic duplication.`;
      findings.push({ id: `dupcls:${d.id}:${cls}`, level: mode === "exclude" ? "high-risk" : "warning", title: "Therapeutic duplication (same class)", detail: txt, matchedFacts: others.map((m) => m.input), sources: [CURATED] });
      if (mode === "exclude") excluded.push(txt);
    }
  }

  // 5. Pregnancy / breastfeeding data gaps and unknown pregnancy status
  const allWhen = new Set([...d.contraindications, ...d.warnings].flatMap((r) => r.when));
  const hasPregnancyData = PREGNANCY_TAGS.some((t) => allWhen.has(t));
  if (st.tags.has("pregnant") && !hasPregnancyData) findings.push({ id: `preg-gap:${d.id}`, level: "warning", title: "Pregnancy data not recorded", detail: `The knowledge base holds no pregnancy-specific rule for ${d.name}. Check the current label/formulary before use in pregnancy.`, sources: [CURATED] });
  if (st.tags.has("breastfeeding") && !allWhen.has("breastfeeding")) findings.push({ id: `bf-gap:${d.id}`, level: "review", title: "Breastfeeding data not recorded", detail: `No breastfeeding-specific rule is held for ${d.name}; check LactMed/label.`, sources: [{ sourceId: "cds-curated", reference: "Data-gap disclosure" }] });
  if (st.tags.has("pregnancy-status-unknown") && hasPregnancyData) findings.push({ id: `preg-unknown:${d.id}`, level: "warning", title: "Pregnancy status unknown", detail: `${d.name} has pregnancy restrictions; confirm pregnancy status before prescribing.`, sources: [CURATED] });

  const status = excluded.length ? "excluded" : findings.some((f) => ["warning", "interaction", "high-risk"].includes(f.level)) ? "caution" : "no-conflict-in-entered-data";
  return { findings, status, exclusionReasons: excluded };
}

/**
 * Reviews the patient's CURRENT regimen (before any candidate is considered): interactions between current medicines
 * and same-ingredient duplication (e.g. a fixed-dose combination plus a single-ingredient product).
 */
export function reviewCurrentRegimen(st: PatientState, idx: KnowledgeIndex): SafetyFinding[] {
  const out: SafetyFinding[] = [];
  const meds = st.meds;
  const sideMatches = (x: string, m: PatientState["meds"][number]) => (x.startsWith("class:") ? m.classTags.includes(x.slice(6)) : m.drugIds.includes(x));
  for (let i = 0; i < meds.length; i++) {
    // interactions inside a single fixed-dose combination are not reported as regimen interactions
    for (let j = i + 1; j < meds.length; j++) {
      const A = meds[i];
      const B = meds[j];
      for (const x of idx.kb.drugInteractions as DrugInteraction[]) {
        if ((sideMatches(x.a, A) && sideMatches(x.b, B)) || (sideMatches(x.a, B) && sideMatches(x.b, A))) {
          out.push({ id: `regimen:${x.id}:${i}:${j}`, ruleId: x.id, level: x.severity === "minor" ? "info" : x.severity === "moderate" ? "interaction" : "high-risk",
            title: `Current regimen: ${A.input} + ${B.input} (${x.severity})`, detail: `${x.effect} Management: ${x.management}`, matchedFacts: [A.input, B.input], sources: x.sources });
        }
      }
      const shared = A.ingredients.map(normalizeText).filter((n) => B.ingredients.map(normalizeText).includes(n));
      if (shared.length) out.push({ id: `regimen:dup:${i}:${j}`, level: "high-risk", title: `Duplicate ingredient in current regimen: ${A.input} + ${B.input}`, detail: `Both contain ${[...new Set(shared)].join(", ")}.`, matchedFacts: [A.input, B.input], sources: [CURATED] });
    }
  }
  // Current medicines against the patient's state (e.g. metformin with eGFR < 30): drug–disease / organ-function review.
  for (const m of meds) {
    for (const id of m.drugIds) {
      const d = idx.drug.get(id);
      if (!d) continue;
      for (const r of [...d.contraindications, ...d.warnings]) {
        if (r.severity === "monitor") continue;
        const hit = r.when.filter((t) => t !== "any" && st.tags.has(t));
        if (!hit.length) continue;
        out.push({ id: `regimen:rule:${id}:${r.id}`, ruleId: r.id, level: r.severity === "caution" ? "warning" : "high-risk",
          title: `Current medicine ${m.input} — ${r.severity === "contraindicated" ? "contraindication" : r.severity}`, detail: r.text, matchedFacts: hit, sources: [r.source] });
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((f) => { const k = `${f.ruleId ?? f.id}|${f.matchedFacts?.join("+")}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
