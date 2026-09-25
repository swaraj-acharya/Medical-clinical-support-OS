import type {
  AyurvedaIndicationTerm, AyurvedicFormulation, AyurvedicHerb, ClinicalContext, ClinicalGuideline, Drug, DrugClassLexiconEntry,
  GuidelineRecommendation, HistoryCondition, HomeopathyRemedy, MasterKnowledge, RedFlagRule, SymptomConcept,
} from "../../types/knowledge";
import { Lexicon, type LexiconEntry } from "../normalize/lexicon";
import { normalizeText } from "../normalize/text";

export interface KnowledgeIndex {
  kb: MasterKnowledge;
  symptom: Map<string, SymptomConcept>;
  drug: Map<string, Drug>;
  context: Map<string, ClinicalContext>;
  guideline: Map<string, ClinicalGuideline>;
  recsByContext: Map<string, GuidelineRecommendation[]>;
  herb: Map<string, AyurvedicHerb>;
  formulation: Map<string, AyurvedicFormulation>;
  remedy: Map<string, HomeopathyRemedy>;
  redFlag: Map<string, RedFlagRule>;
  historyCondition: Map<string, HistoryCondition>;
  classLexicon: DrugClassLexiconEntry[];
  ayurvedaTerms: AyurvedaIndicationTerm[];
  symptomLexicon: Lexicon;
  drugLexicon: Lexicon;
  conditionLexicon: Lexicon;
  /** drug ids whose ingredients include the given ingredient name (normalised) */
  drugsByIngredient: Map<string, string[]>;
  sourceName: Map<string, string>;
}

let cache: { hash: string; index: KnowledgeIndex } | null = null;

export function buildIndex(kb: MasterKnowledge): KnowledgeIndex {
  if (cache && cache.hash === kb.metadata.contentHash && cache.index.kb === kb) return cache.index;

  const symptomEntries: LexiconEntry[] = [];
  for (const s of kb.symptoms) {
    symptomEntries.push({ term: s.label, conceptId: s.id, role: "label" });
    for (const syn of s.synonyms) symptomEntries.push({ term: syn, conceptId: s.id, role: "synonym" });
    for (const a of s.ayurvedaTerms) symptomEntries.push({ term: a, conceptId: s.id, role: "synonym" });
  }
  for (const t of kb.ayurvedicIndications) for (const v of [t.term, ...t.variants]) for (const sid of t.symptomIds) symptomEntries.push({ term: v, conceptId: sid, role: "synonym" });

  const drugEntries: LexiconEntry[] = [];
  const drugsByIngredient = new Map<string, string[]>();
  for (const d of kb.drugs) {
    drugEntries.push({ term: d.name, conceptId: d.id, role: "label" });
    drugEntries.push({ term: d.genericName.replace(/\(.*\)/, "").trim(), conceptId: d.id, role: "synonym" });
    for (const s of d.synonyms) drugEntries.push({ term: s, conceptId: d.id, role: "synonym" });
    for (const b of d.brandMappings) if (b.composition.length === 1) drugEntries.push({ term: b.brand, conceptId: d.id, role: "synonym" });
    for (const c of d.composition) {
      const k = normalizeText(c.name);
      drugsByIngredient.set(k, [...new Set([...(drugsByIngredient.get(k) ?? []), d.id])]);
    }
    for (const s of d.synonyms) {
      const k = normalizeText(s);
      drugsByIngredient.set(k, [...new Set([...(drugsByIngredient.get(k) ?? []), d.id])]);
    }
  }

  const condEntries: LexiconEntry[] = [];
  for (const h of kb.historyConditions) {
    condEntries.push({ term: h.label, conceptId: h.id, role: "label" });
    for (const s of h.synonyms) condEntries.push({ term: s, conceptId: h.id, role: "synonym" });
  }

  const recsByContext = new Map<string, GuidelineRecommendation[]>();
  for (const r of kb.guidelineRecommendations) recsByContext.set(r.contextId, [...(recsByContext.get(r.contextId) ?? []), r]);

  const index: KnowledgeIndex = {
    kb,
    symptom: new Map(kb.symptoms.map((s) => [s.id, s])),
    drug: new Map(kb.drugs.map((d) => [d.id, d])),
    context: new Map(kb.conditions.map((c) => [c.id, c])),
    guideline: new Map(kb.clinicalGuidelines.map((g) => [g.id, g])),
    recsByContext,
    herb: new Map(kb.ayurvedicHerbs.map((h) => [h.id, h])),
    formulation: new Map(kb.ayurvedicFormulations.map((f) => [f.id, f])),
    remedy: new Map(kb.homeopathyRemedies.map((r) => [r.id, r])),
    redFlag: new Map(kb.redFlags.map((r) => [r.id, r])),
    historyCondition: new Map(kb.historyConditions.map((h) => [h.id, h])),
    classLexicon: kb.drugClassLexicon ?? [],
    ayurvedaTerms: kb.ayurvedicIndications,
    symptomLexicon: new Lexicon(symptomEntries),
    drugLexicon: new Lexicon(drugEntries),
    conditionLexicon: new Lexicon(condEntries),
    drugsByIngredient,
    sourceName: new Map(kb.sources.map((s) => [s.id, s.name])),
  };
  cache = { hash: kb.metadata.contentHash, index };
  return index;
}
