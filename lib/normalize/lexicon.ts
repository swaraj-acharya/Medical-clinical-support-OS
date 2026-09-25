import { containsPhrase, levenshtein, normalizeText, stemPhrase, trigramSimilarity } from "./text";

export type MatchType = "exact" | "synonym" | "normalized" | "fuzzy";

export interface LexiconEntry {
  term: string;
  conceptId: string;
  /** label = preferred name; synonym = curated synonym / brand / variant spelling */
  role: "label" | "synonym";
}

export interface LexiconMatch {
  conceptId: string;
  matchedTerm: string;
  matchType: MatchType;
  score: number;
}

export interface ExtractedMention {
  conceptId: string;
  matchedTerm: string;
  phrase: string;
  matchType: MatchType;
}

interface Indexed extends LexiconEntry { norm: string; stemmed: string }

/**
 * Multi-strategy lexicon lookup, in order of trust:
 *   exact (preferred label) → synonym (curated synonym, brand, variant) → normalized (diacritics / punctuation /
 *   plural forms) → fuzzy (trigram similarity or small edit distance).
 * The match type is always returned so the UI can show *how* a term was recognised.
 */
export class Lexicon {
  private entries: Indexed[];
  private byNorm = new Map<string, Indexed[]>();
  private byStem = new Map<string, Indexed[]>();
  private longestFirst: Indexed[];

  constructor(entries: LexiconEntry[]) {
    this.entries = entries
      .filter((e) => e.term && e.term.trim())
      .map((e) => ({ ...e, norm: normalizeText(e.term), stemmed: stemPhrase(e.term) }))
      .filter((e) => e.norm.length > 0);
    for (const e of this.entries) {
      this.byNorm.set(e.norm, [...(this.byNorm.get(e.norm) ?? []), e]);
      this.byStem.set(e.stemmed, [...(this.byStem.get(e.stemmed) ?? []), e]);
    }
    this.longestFirst = [...this.entries].sort((a, b) => b.norm.length - a.norm.length);
  }

  get size() {
    return this.entries.length;
  }

  lookup(query: string, opts: { limit?: number; fuzzy?: boolean; fuzzyThreshold?: number } = {}): LexiconMatch[] {
    const limit = opts.limit ?? 10;
    const q = query.trim();
    if (!q) return [];
    const qn = normalizeText(q);
    if (!qn) return [];
    const qs = stemPhrase(q);
    const out = new Map<string, LexiconMatch>();
    const push = (e: Indexed, matchType: MatchType, score: number) => {
      const prev = out.get(e.conceptId);
      if (!prev || prev.score < score) out.set(e.conceptId, { conceptId: e.conceptId, matchedTerm: e.term, matchType, score });
    };
    for (const e of this.byNorm.get(qn) ?? []) {
      const literal = e.term.trim().toLowerCase() === q.toLowerCase();
      if (e.role === "label") push(e, literal ? "exact" : "normalized", literal ? 1 : 0.95);
      else push(e, literal ? "synonym" : "normalized", literal ? 0.97 : 0.93);
    }
    for (const e of this.byStem.get(qs) ?? []) push(e, "normalized", 0.9);
    if (opts.fuzzy !== false && qn.length >= 3) {
      const threshold = opts.fuzzyThreshold ?? 0.42;
      for (const e of this.entries) {
        if ((out.get(e.conceptId)?.score ?? 0) >= 0.9) continue;
        let score = 0;
        if (e.norm.startsWith(qn) || containsPhrase(e.norm, qn)) score = 0.7 + 0.15 * (qn.length / Math.max(e.norm.length, 1));
        else {
          const sim = trigramSimilarity(qn, e.norm);
          if (sim >= threshold) score = 0.4 + sim * 0.4;
          else if (qn.length >= 5 && e.norm.length >= 5 && levenshtein(qn, e.norm, 2) <= (qn.length >= 8 ? 2 : 1)) score = 0.6;
        }
        if (score > 0) push(e, "fuzzy", Math.min(score, 0.89));
      }
    }
    return [...out.values()].sort((a, b) => b.score - a.score || a.matchedTerm.length - b.matchedTerm.length).slice(0, limit);
  }

  /**
   * Finds lexicon terms mentioned inside free text (longest phrases first, word boundaries only), plus single-token
   * fuzzy hits for obvious misspellings ("hedache"). Used by Deterministic Mode extraction.
   */
  extract(text: string): ExtractedMention[] {
    const hay = normalizeText(text);
    if (!hay) return [];
    const found = new Map<string, ExtractedMention>();
    let remaining = ` ${hay} `;
    const remainingStem = () => ` ${remaining.trim().split(" ").map((t) => stemPhrase(t)).join(" ")} `;
    for (const e of this.longestFirst) {
      if (e.norm.length < 3) continue;
      const direct = remaining.includes(` ${e.norm} `);
      const stemmed = !direct && e.stemmed.length >= 4 && remainingStem().includes(` ${e.stemmed} `);
      if (direct || stemmed) {
        if (!found.has(e.conceptId)) found.set(e.conceptId, { conceptId: e.conceptId, matchedTerm: e.term, phrase: e.norm, matchType: e.role === "label" ? "exact" : "synonym" });
        if (direct) remaining = remaining.replace(` ${e.norm} `, " _ ");
      }
    }
    const tokens = remaining.trim().split(" ").filter((t) => t.length >= 6);
    for (const t of tokens) {
      for (const e of this.entries) {
        if (found.has(e.conceptId) || e.norm.includes(" ") || e.norm.length < 6) continue;
        if (levenshtein(t, e.norm, 1) <= 1) {
          found.set(e.conceptId, { conceptId: e.conceptId, matchedTerm: e.term, phrase: t, matchType: "fuzzy" });
          break;
        }
      }
    }
    return [...found.values()];
  }
}
