import type { AyurvedaIndicationTerm, AyurvedicFormulation, AyurvedicHerb } from "../../types/knowledge";
import type { SourceRef } from "../../types/provenance";
import type { AyurvedaCandidate, EvidenceLabel, SafetyFinding, SystemResult, WhyItem } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { normalizeText } from "../normalize/text";
import type { PatientState } from "../safety/patient-state";
import type { CaseInput } from "../validation/case-schema";
import { phraseMatches } from "./context";

export const AYURVEDA_METHOD =
  "Ayurvedic context matching: entered symptoms are bridged to classical Ayurvedic terms (approximate correlates, not NAMASTE codes) and matched against classical indications recorded for herbs (Dravya) and formulations (Kalpana). The clinician's dosha, agni and ama assessment then marks each item as supporting or needing review using recorded rasa/guna/virya/vipaka/prabhava and dosha actions. Traditional rationale and modern evidence are shown separately.";
export const AYURVEDA_FRAMING =
  "Classical/traditional rationale (Amidha Ayurveda open datasets, CC BY 4.0) — not evidence of clinical efficacy. No modern clinical evidence is recorded for these items in the current knowledge base unless shown.";

const MAX_PER_KIND = 6;
const KARMA_SUFFIXES = ["hara", "ghna", "ghni", "nashak", "nashana", "nashaka"];

interface CaseTerm { term: string; label: string; variants: string[]; symptomIds: string[]; source: SourceRef }

export function caseAyurvedaTerms(st: PatientState, idx: KnowledgeIndex): CaseTerm[] {
  const out: CaseTerm[] = [];
  for (const t of idx.ayurvedaTerms as AyurvedaIndicationTerm[]) {
    const sids = t.symptomIds.filter((s) => st.symptomsPresent.has(s));
    if (!sids.length) continue;
    if (t.requiresDetail) {
      const s = st.symptomDetail.get(t.requiresDetail.symptomId);
      const v = s ? (s as Record<string, unknown>)[t.requiresDetail.field] : undefined;
      if (typeof v !== "string" || !phraseMatches([v], t.requiresDetail.anyOf)) continue;
    }
    out.push({ term: t.term, label: t.label, variants: [t.term, ...t.variants].map(normalizeText), symptomIds: sids, source: t.source });
  }
  return out;
}

function itemMatches(item: string, variants: string[], allowKarma: boolean) {
  const n = normalizeText(item);
  for (const v of variants) {
    if (` ${n} `.includes(` ${v} `)) return true;
    if (allowKarma && KARMA_SUFFIXES.some((s) => n.replace(/ /g, "") === v.replace(/ /g, "") + s)) return true;
  }
  return false;
}

function matchTerms(items: string[], prabhava: string[], terms: CaseTerm[]) {
  const matched: CaseTerm[] = [];
  const phrases: string[] = [];
  for (const t of terms) {
    const hit = items.find((i) => itemMatches(i, t.variants, false)) ?? prabhava.find((p) => itemMatches(p, t.variants, true));
    if (hit) { matched.push(t); phrases.push(hit); }
  }
  return { matched, phrases };
}

const hasAny = (hay: string[], terms: string[]) => { const h = hay.map(normalizeText).join(" | "); return terms.some((t) => h.includes(normalizeText(t))); };

export function runAyurveda(c: CaseInput, st: PatientState, idx: KnowledgeIndex): SystemResult<AyurvedaCandidate> {
  const kb = idx.kb;
  const result: SystemResult<AyurvedaCandidate> = { system: "ayurveda", methodology: AYURVEDA_METHOD, evidenceFraming: AYURVEDA_FRAMING, candidates: [], excluded: [], advisories: [], notFound: [] };
  const terms = caseAyurvedaTerms(st, idx);
  if (!terms.length) {
    result.notFound.push("None of the entered symptoms has an Ayurvedic terminology bridge in this build; no classical-indication match is possible. Consider recording the Ayurvedic diagnosis in the assessment note.");
    return result;
  }
  result.advisories.push({ kind: "note", text: `Symptoms bridged to classical terms (approximate correlates, not NAMASTE codes): ${terms.map((t) => `${t.label}`).join("; ")}.`, sources: [terms[0].source] });

  const ay = c.ayurveda;
  const rules = kb.ayurvedicRules;
  const gs = kb.ayurvedicSafety.generalSafety;
  const herbSafety = new Map(kb.ayurvedicSafety.herbSafety.map((h) => [h.herbId, h]));
  const onClasses = gs.herbDrug.classTags.filter((t) => st.medClassTags.has(t));
  const principleSource = (ids: string[]) => ids.map((id) => ({ sourceId: "siddhanta-kosha", reference: `${kb.ayurvedicPrinciples.find((p) => p.id === id)?.name ?? id} (${id})`, url: "https://doi.org/10.5281/zenodo.17481343" }));

  if (ay) {
    for (const obs of ay.doshaObservations) {
      const r = rules.doshaSupport[obs];
      if (r) result.advisories.push({ kind: "note", text: r.text, sources: r.sources });
      else result.advisories.push({ kind: "note", text: `${obs}: no curated support/caution rule in this build — recorded for the clinician only.`, sources: [{ sourceId: "cds-curated", reference: "Ayurveda rules v1" }] });
    }
    if (ay.agni !== "not-assessed" && rules.agni[ay.agni]) result.advisories.push({ kind: "note", text: rules.agni[ay.agni].text, sources: rules.agni[ay.agni].sources });
    if (ay.ama === "present" && rules.ama.present) result.advisories.push({ kind: "note", text: rules.ama.present.text, sources: rules.ama.present.sources });
  } else {
    result.advisories.push({ kind: "note", text: "No dosha/agni/ama assessment recorded — items are matched on classical indications only.", sources: [{ sourceId: "cds-curated", reference: "Ayurveda rules v1" }] });
  }

  type Scored = { cand: AyurvedaCandidate; rank: number };
  const scored: Scored[] = [];

  const doshaEval = (pac: string[], agg: string[], virya: string, tridosha: boolean) => {
    const support: string[] = [];
    const cautions: string[] = [];
    for (const obs of ay?.doshaObservations ?? []) {
      const r = rules.doshaSupport[obs];
      if (!r) continue;
      if (tridosha || pac.some((p) => p.toLowerCase() === r.pacifies.toLowerCase() || p.toLowerCase() === "tridosha")) support.push(`${r.pacifies}-pacifying recorded (observed ${obs})`);
      if (agg.some((p) => p.toLowerCase() === r.cautionIfAggravates.toLowerCase())) cautions.push(`Recorded as aggravating ${r.cautionIfAggravates} (observed ${obs})`);
      if (r.cautionVirya && virya.toLowerCase() === r.cautionVirya.toLowerCase()) cautions.push(`${virya} virya with observed ${obs}`);
    }
    if (ay?.agni === "tikshna" && rules.agni.tikshna?.cautionVirya && virya.toLowerCase() === rules.agni.tikshna.cautionVirya.toLowerCase()) cautions.push(`${virya} virya with Tikshna agni`);
    return { support, cautions };
  };

  const commonSafety = (id: string, name: string, extra: SafetyFinding[], excludedBy: string[]) => {
    const findings = [...extra];
    if (st.tags.has("pregnant") || st.tags.has("breastfeeding")) findings.push({ id: `${gs.pregnancy.id}:${id}`, level: "warning", title: "Pregnancy/breastfeeding safety not verified", detail: gs.pregnancy.text, sources: [gs.pregnancy.source] });
    if (onClasses.length) findings.push({ id: `${gs.herbDrug.id}:${id}`, level: "warning", title: "Herb–drug interaction review", detail: gs.herbDrug.text.replace("{classes}", onClasses.join(", ")), matchedFacts: onClasses, sources: [gs.herbDrug.source] });
    const status: AyurvedaCandidate["safetyStatus"] = excludedBy.length ? "excluded" : findings.some((f) => ["warning", "high-risk", "interaction"].includes(f.level)) ? "caution" : "no-conflict-in-entered-data";
    if (excludedBy.length) result.excluded.push({ name, entityId: id, reason: excludedBy.join(" · ") });
    return { findings, status };
  };

  const evidenceFor = (source: SourceRef): EvidenceLabel[] => [
    { category: "traditional-classical", summary: "Classical indication and properties as recorded in the source dataset.", source },
    { category: "insufficient-evidence", summary: gs.noModernEvidence.text, source: gs.noModernEvidence.source },
  ];

  // ---- herbs
  for (const h of kb.ayurvedicHerbs as AyurvedicHerb[]) {
    const { matched, phrases } = matchTerms(h.mainIndications, h.prabhava, terms);
    if (!matched.length) continue;
    const dz = doshaEval(h.pacifies, h.aggravates, h.virya, h.tridosha);
    const extra: SafetyFinding[] = [];
    const excludedBy: string[] = [];
    const hs = herbSafety.get(h.id);
    if (hs) {
      const hit = hs.tagsHighRisk.filter((t) => st.tags.has(t));
      extra.push({ id: `${hs.note.id}:${h.id}`, level: hit.length ? "high-risk" : "warning", title: "Herb safety note", detail: hs.note.text, matchedFacts: hit, sources: [hs.note.source] });
      if (hit.length) excludedBy.push(`${hs.note.text} (patient: ${hit.join(", ")})`);
    }
    for (const cmsg of dz.cautions) extra.push({ id: `dosha:${h.id}:${cmsg}`, level: "review", title: "Ayurvedic caution", detail: cmsg, sources: h.sources });
    const { findings, status } = commonSafety(h.id, h.name, extra, excludedBy);
    if (status === "excluded") continue;
    const covered = new Set(matched.flatMap((m) => m.symptomIds));
    const agniRel = ay?.agni === "manda" && hasAny([...h.mainIndications, ...h.prabhava], rules.agni.manda?.supportTerms ?? []);
    const amaRel = ay?.ama === "present" && hasAny([...h.mainIndications, ...h.prabhava], rules.ama.present?.supportTerms ?? []);
    const why: WhyItem[] = [
      { kind: "traditional", text: `Classical indication(s) recorded: ${[...new Set(phrases)].join(", ")} — bridged from ${matched.map((m) => m.label).join("; ")}`, sources: h.sources },
      { kind: "traditional", text: `Properties: rasa ${h.rasa.join("/") || "—"}, guna ${h.guna.join("/") || "—"}, virya ${h.virya || "—"}, vipaka ${h.vipaka || "—"}${h.prabhava.length ? `, karma/prabhava ${h.prabhava.join(", ")}` : ""}. Pacifies ${h.pacifies.join(", ") || "—"}${h.aggravates.length ? `; aggravates ${h.aggravates.join(", ")}` : ""}.`, sources: h.sources },
    ];
    for (const s of dz.support) why.push({ kind: "match", text: s });
    if (agniRel) why.push({ kind: "match", text: "Deepana/Pachana or Agnimandya indication — relevant to recorded Manda agni", sources: principleSource(rules.agni.manda.principleIds) });
    if (amaRel) why.push({ kind: "match", text: "Ama-pachana relevance — Ama recorded as present", sources: principleSource(rules.ama.present.principleIds) });
    const rank = covered.size * 10 + matched.length * 2 + dz.support.length * 3 - dz.cautions.length * 4 + (agniRel ? 2 : 0) + (amaRel ? 2 : 0) - (status === "caution" ? 1 : 0);
    scored.push({
      rank,
      cand: {
        id: `ayur:${h.id}`, system: "ayurveda", kind: "herb", entityId: h.id, name: `${h.name}${h.botanicalName ? ` (${h.botanicalName})` : ""}`,
        surfacedBecause: why, safety: findings, safetyStatus: status, evidence: evidenceFor(h.sources[0]), sources: h.sources, lastVerified: h.sources[0]?.lastVerified ?? "unknown",
        metric: { label: "Ayurvedic context match", matchedTerms: matched.map((m) => m.label), doshaSupport: dz.support, doshaCautions: dz.cautions },
      },
    });
  }

  // ---- formulations
  for (const f of kb.ayurvedicFormulations as AyurvedicFormulation[]) {
    const { matched, phrases } = matchTerms([...f.indicationTerms, f.category], [], terms);
    if (!matched.length) continue;
    const herbsIn = f.ingredientHerbIds.map((id) => idx.herb.get(id)).filter((x): x is AyurvedicHerb => Boolean(x));
    const support: string[] = [];
    const cautions: string[] = [];
    for (const obs of ay?.doshaObservations ?? []) {
      const r = rules.doshaSupport[obs];
      if (!r || !herbsIn.length) continue;
      const pac = herbsIn.filter((h) => h.tridosha || h.pacifies.some((p) => p.toLowerCase() === r.pacifies.toLowerCase()));
      const agg = herbsIn.filter((h) => h.aggravates.some((p) => p.toLowerCase() === r.cautionIfAggravates.toLowerCase()));
      if (pac.length) support.push(`${pac.length}/${herbsIn.length} linked ingredient herbs recorded as ${r.pacifies}-pacifying (observed ${obs})`);
      if (agg.length) cautions.push(`${agg.map((h) => h.name).join(", ")} recorded as aggravating ${r.cautionIfAggravates} (observed ${obs})`);
    }
    if (/\bpitta\b.*pacif|pacif.*\bpitta\b/i.test(f.indicationsText) && ay?.doshaObservations.includes("pitta-vriddhi")) support.push("Source text describes the formulation as Pitta-pacifying");
    const extra: SafetyFinding[] = [];
    const excludedBy: string[] = [];
    if (f.containsMineralsOrMetals) {
      const hit = gs.rasaushadhi.highRiskTags.filter((t) => st.tags.has(t));
      extra.push({ id: `${gs.rasaushadhi.id}:${f.id}`, level: "high-risk", title: "Rasaushadhi (mineral/metal) preparation", detail: gs.rasaushadhi.text, matchedFacts: hit, sources: [gs.rasaushadhi.source] });
      if (hit.length) excludedBy.push(`Mineral/metal preparation with patient factor(s): ${hit.join(", ")}`);
    }
    for (const hid of f.ingredientHerbIds) {
      const hs = herbSafety.get(hid);
      if (!hs) continue;
      const hit = hs.tagsHighRisk.filter((t) => st.tags.has(t));
      extra.push({ id: `${hs.note.id}:${f.id}`, level: hit.length ? "high-risk" : "review", title: `Ingredient safety note (${hid.replace("herb_", "")})`, detail: hs.note.text, matchedFacts: hit, sources: [hs.note.source] });
      if (hit.length) excludedBy.push(`Contains ${hid.replace("herb_", "")}: ${hs.note.text}`);
    }
    for (const cmsg of cautions) extra.push({ id: `dosha:${f.id}:${cmsg}`, level: "review", title: "Ayurvedic caution", detail: cmsg, sources: f.sources });
    const { findings, status } = commonSafety(f.id, f.name, extra, excludedBy);
    if (status === "excluded") continue;
    const covered = new Set(matched.flatMap((m) => m.symptomIds));
    const hay = [...f.indicationTerms, f.indicationsText, f.category];
    const agniRel = ay?.agni === "manda" && hasAny(hay, rules.agni.manda?.supportTerms ?? []);
    const amaRel = ay?.ama === "present" && hasAny(hay, rules.ama.present?.supportTerms ?? []);
    const why: WhyItem[] = [
      { kind: "traditional", text: `Classical indication(s) recorded: ${[...new Set(phrases)].join(", ")} — bridged from ${matched.map((m) => m.label).join("; ")}`, sources: f.sources },
      { kind: "traditional", text: `${f.formulationType} · ${f.category}. Main ingredients: ${f.mainIngredients.join(", ")}. Reference as stated in source: ${f.classicalReference || "—"}.`, sources: f.sources },
    ];
    for (const s of support) why.push({ kind: "match", text: s });
    if (agniRel) why.push({ kind: "match", text: "Deepana/Pachana or Agnimandya indication — relevant to recorded Manda agni", sources: principleSource(rules.agni.manda.principleIds) });
    if (amaRel) why.push({ kind: "match", text: "Ama-pachana relevance — Ama recorded as present", sources: principleSource(rules.ama.present.principleIds) });
    const rank = covered.size * 10 + matched.length * 2 + support.length * 3 - cautions.length * 4 + (agniRel ? 2 : 0) + (amaRel ? 2 : 0) - (f.containsMineralsOrMetals ? 3 : 0) - (status === "caution" ? 1 : 0);
    scored.push({
      rank,
      cand: {
        id: `ayur:${f.id}`, system: "ayurveda", kind: "formulation", entityId: f.id, name: f.name,
        surfacedBecause: why, safety: findings, safetyStatus: status, evidence: evidenceFor(f.sources[0]), sources: f.sources, lastVerified: f.sources[0]?.lastVerified ?? "unknown",
        metric: { label: "Ayurvedic context match", matchedTerms: matched.map((m) => m.label), doshaSupport: support, doshaCautions: cautions },
      },
    });
  }

  scored.sort((a, b) => b.rank - a.rank || a.cand.name.localeCompare(b.cand.name));
  const forms = scored.filter((s) => s.cand.kind === "formulation");
  const herbs = scored.filter((s) => s.cand.kind === "herb");
  result.candidates = [...forms.slice(0, MAX_PER_KIND), ...herbs.slice(0, MAX_PER_KIND)].sort((a, b) => b.rank - a.rank).map((s) => s.cand);
  const hidden = Math.max(0, forms.length - MAX_PER_KIND) + Math.max(0, herbs.length - MAX_PER_KIND);
  if (hidden) result.advisories.push({ kind: "note", text: `${hidden} further matching item(s) not shown (lower context match). Use the Ayurveda explorer to browse all.`, sources: [] });
  return result;
}
