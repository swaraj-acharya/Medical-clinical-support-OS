/** Global search across the knowledge base: exact, synonym/brand, normalised and fuzzy matching, grouped by type. */
import type { KnowledgeIndex } from "../knowledge/indexes";
import { getRegistry } from "../knowledge/store";
import { normalizeText, trigramSimilarity } from "../normalize/text";
import { searchRubrics } from "../engines/repertory";

export type SearchType = "symptom" | "medicine" | "herb" | "formulation" | "remedy" | "rubric" | "context" | "guideline" | "principle" | "source" | "red-flag";
export interface SearchHit { type: SearchType; id: string; label: string; detail: string; href: string; matchType: "exact" | "synonym" | "normalized" | "fuzzy"; matchedTerm: string; score: number }

interface Doc { type: SearchType; id: string; label: string; detail: string; href: string; terms: { t: string; norm: string; syn: boolean }[] }

let docsCache: { hash: string; docs: Doc[] } | null = null;

function docs(idx: KnowledgeIndex): Doc[] {
  if (docsCache?.hash === idx.kb.metadata.contentHash) return docsCache.docs;
  const kb = idx.kb;
  const mk = (type: SearchType, id: string, label: string, detail: string, href: string, synonyms: string[]): Doc => ({
    type, id, label, detail, href, terms: [{ t: label, norm: normalizeText(label), syn: false }, ...synonyms.filter(Boolean).map((t) => ({ t, norm: normalizeText(t), syn: true }))],
  });
  const out: Doc[] = [];
  for (const s of kb.symptoms) out.push(mk("symptom", s.id, s.label, `Symptom · ${s.bodySystem}`, `/search?q=${encodeURIComponent(s.label)}&type=symptom`, [...s.synonyms, ...s.ayurvedaTerms]));
  for (const d of kb.drugs) out.push(mk("medicine", d.id, d.name, d.pharmacologicClass, `/medicines/${d.id}`, [...d.synonyms, d.genericName, ...d.brandMappings.map((b) => b.brand)]));
  for (const h of kb.ayurvedicHerbs) out.push(mk("herb", h.id, h.name, `Herb · ${h.botanicalName}`, `/medicines/${h.id}`, [h.botanicalName, h.englishName, ...h.sanskritSynonyms]));
  for (const f of kb.ayurvedicFormulations) out.push(mk("formulation", f.id, f.name, `${f.formulationType} · ${f.category}`, `/medicines/${f.id}`, []));
  for (const p of kb.ayurvedicPrinciples) out.push(mk("principle", p.id, p.name, `Principle · ${p.category}`, `/ayurveda?tab=principles&q=${encodeURIComponent(p.name)}`, []));
  for (const r of kb.homeopathyRemedies) out.push(mk("remedy", r.id, r.name, `Remedy · ${r.abbrev}`, `/medicines/${r.id}`, [r.abbrev, ...r.altNames]));
  for (const c of kb.conditions) out.push(mk("context", c.id, c.label, "Clinical context", `/search?q=${encodeURIComponent(c.label)}&type=context`, c.codes.map((x) => x.display ?? "")));
  for (const g of kb.clinicalGuidelines) out.push(mk("guideline", g.id, g.title, `${g.issuer} · ${g.version}`, g.url, [g.issuer]));
  for (const r of kb.redFlags) out.push(mk("red-flag", r.id, r.title, `Red flag · ${r.severity}`, `/admin#red-flags`, [r.category]));
  for (const s of getRegistry()) out.push(mk("source", s.id, s.name, `Source · level ${s.level} · ${s.dataLicense}`, `/sources#${s.id}`, [s.id]));
  docsCache = { hash: kb.metadata.contentHash, docs: out };
  return out;
}

export function globalSearch(q: string, idx: KnowledgeIndex, opts: { limit?: number; types?: SearchType[] } = {}): SearchHit[] {
  const qn = normalizeText(q);
  if (qn.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const d of docs(idx)) {
    if (opts.types && !opts.types.includes(d.type)) continue;
    let best: SearchHit | null = null;
    for (const term of d.terms) {
      if (!term.norm) continue;
      let score = 0;
      let matchType: SearchHit["matchType"] = "fuzzy";
      if (term.t.trim().toLowerCase() === q.trim().toLowerCase()) { score = term.syn ? 95 : 100; matchType = term.syn ? "synonym" : "exact"; }
      else if (term.norm === qn) { score = 92; matchType = term.syn ? "synonym" : "normalized"; }
      else if (term.norm.startsWith(qn)) { score = 75 + (qn.length / term.norm.length) * 10; matchType = term.syn ? "synonym" : "normalized"; }
      else if (` ${term.norm} `.includes(` ${qn}`)) { score = 65; matchType = term.syn ? "synonym" : "normalized"; }
      else if (qn.length >= 4) {
        const sim = trigramSimilarity(qn, term.norm);
        if (sim >= 0.38) { score = 30 + sim * 40; matchType = "fuzzy"; }
      }
      if (score && (!best || score > best.score)) best = { type: d.type, id: d.id, label: d.label, detail: d.detail, href: d.href, matchType, matchedTerm: term.t, score };
    }
    if (best) hits.push(best);
  }
  if (!opts.types || opts.types.includes("rubric")) {
    for (const r of searchRubrics(q, { limit: 8 })) hits.push({ type: "rubric", id: r.id, label: r.path, detail: `Rubric · ${r.remedyCount} remedies`, href: `/repertory?rubric=${r.id}`, matchType: "normalized", matchedTerm: r.path, score: 55 });
  }
  return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, opts.limit ?? 60);
}
