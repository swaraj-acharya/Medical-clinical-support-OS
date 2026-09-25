/** Text normalisation and fuzzy matching primitives (no external dependencies). */

/** Lower-case, strip diacritics, unify separators, collapse whitespace. "Sir-Dard!" → "sir dard". */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Very small stemmer for English plurals / -ing forms, used only for matching ("headaches" → "headache"). */
export function stem(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 4 && token.endsWith("es") && !token.endsWith("ses")) return token.slice(0, -1);
  if (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

export const stemPhrase = (s: string) => normalizeText(s).split(" ").map(stem).join(" ");

function trigrams(s: string): Set<string> {
  const p = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
}

/** Jaccard similarity of character trigrams, 0..1. */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Levenshtein distance with an early-exit ceiling (returns max+1 when exceeded). */
export function levenshtein(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    let rowMin = row[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return row[b.length];
}

/** True when `needle` occurs in `hay` on word boundaries (both already normalised). */
export function containsPhrase(hay: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${hay} `.includes(` ${needle} `);
}

/** Days represented by a duration value/unit pair. */
export function toDays(value: number | undefined, unit: string | undefined): number | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) return undefined;
  const f: Record<string, number> = { hours: 1 / 24, days: 1, weeks: 7, months: 30, years: 365 };
  return value * (f[unit ?? "days"] ?? 1);
}
