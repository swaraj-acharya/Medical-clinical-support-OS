import type { KnowledgeIndex } from "../knowledge/indexes";
import type { MatchType } from "./lexicon";
import { containsPhrase, normalizeText } from "./text";

export interface ResolvedMedication {
  input: string;
  drugIds: string[];
  classTags: string[];
  ingredients: string[];
  matchType: MatchType | "unrecognised";
  via: "brand" | "generic" | "class-lexicon" | "fuzzy" | "explicit-id" | "unrecognised";
  note?: string;
}

const NOISE = new Set(["mg", "mcg", "g", "ml", "tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules", "syrup", "susp", "suspension",
  "inj", "injection", "sr", "er", "xr", "cr", "od", "bd", "tds", "qid", "hs", "sos", "prn", "daily", "once", "twice", "iu", "forte", "ds", "plus"]);

/** Removes strengths, units and frequency words: "Pantoprazole 40 mg OD" → "pantoprazole". */
export function cleanMedicationName(s: string): string {
  return normalizeText(s).split(" ").filter((t) => !NOISE.has(t) && !/^\d+(\.\d+)?$/.test(t)).join(" ");
}

export function resolveMedication(input: string, idx: KnowledgeIndex, explicitDrugId?: string): ResolvedMedication {
  const classesOf = (ids: string[]) => [...new Set(ids.flatMap((id) => idx.drug.get(id)?.classTags ?? []))];
  const ingredientsOf = (ids: string[]) => [...new Set(ids.flatMap((id) => idx.drug.get(id)?.composition.map((c) => c.name) ?? []))];
  if (explicitDrugId && idx.drug.has(explicitDrugId)) {
    return { input, drugIds: [explicitDrugId], classTags: classesOf([explicitDrugId]), ingredients: ingredientsOf([explicitDrugId]), matchType: "exact", via: "explicit-id" };
  }
  const raw = normalizeText(input);
  const clean = cleanMedicationName(input);
  if (!clean && !raw) return { input, drugIds: [], classTags: [], ingredients: [], matchType: "unrecognised", via: "unrecognised" };

  // 1. brand names (incl. fixed-dose combinations → every ingredient)
  for (const d of idx.kb.drugs) {
    for (const b of d.brandMappings) {
      const bn = normalizeText(b.brand);
      const bc = cleanMedicationName(b.brand);
      if (raw === bn || clean === bc || raw.startsWith(bn + " ") || (bc.length >= 4 && (clean === bc || clean.startsWith(bc + " ")))) {
        const ids = [...new Set(b.composition.flatMap((c) => idx.drugsByIngredient.get(normalizeText(c)) ?? []))];
        const unresolved = b.composition.filter((c) => !(idx.drugsByIngredient.get(normalizeText(c)) ?? []).length);
        return {
          input, drugIds: ids, classTags: classesOf(ids), ingredients: b.composition, matchType: "synonym", via: "brand",
          note: `${b.brand} (${b.country}) → ${b.composition.join(" + ")}${unresolved.length ? `; not in drug KB: ${unresolved.join(", ")}` : ""} — brand composition ${b.verification}`,
        };
      }
    }
  }

  // 2. generic names / synonyms mentioned in the text (supports "paracetamol + caffeine")
  const mentions = idx.drugLexicon.extract(clean || raw).filter((m) => m.matchType !== "fuzzy");
  const lexClasses: string[] = [];
  const lexIngredients: string[] = [];
  for (const c of idx.classLexicon) for (const m of c.members) if (containsPhrase(clean || raw, normalizeText(m)) || containsPhrase(raw, normalizeText(m))) { lexClasses.push(c.classTag); lexIngredients.push(m); }
  if (mentions.length) {
    const ids = [...new Set(mentions.map((m) => m.conceptId))];
    return { input, drugIds: ids, classTags: [...new Set([...classesOf(ids), ...lexClasses])], ingredients: [...new Set([...ingredientsOf(ids), ...lexIngredients])], matchType: mentions[0].matchType, via: "generic" };
  }
  // 3. class-membership lexicon (drugs we do not hold as full records, e.g. diclofenac, apixaban)
  if (lexClasses.length) {
    return { input, drugIds: [], classTags: [...new Set(lexClasses)], ingredients: [...new Set(lexIngredients)], matchType: "normalized", via: "class-lexicon",
      note: "Recognised by drug-class lexicon only; full drug record not held — interaction check limited to class-level rules." };
  }
  // 4. fuzzy (typos) — reported as needing verification
  const fz = idx.drugLexicon.lookup(clean || raw, { limit: 1 })[0];
  if (fz && fz.score >= 0.6) {
    return { input, drugIds: [fz.conceptId], classTags: classesOf([fz.conceptId]), ingredients: ingredientsOf([fz.conceptId]), matchType: "fuzzy", via: "fuzzy",
      note: `Fuzzy match to '${fz.matchedTerm}' — confirm the medicine name.` };
  }
  return { input, drugIds: [], classTags: [], ingredients: [], matchType: "unrecognised", via: "unrecognised", note: "Not recognised — interaction and duplicate checks could not be completed for this entry." };
}

const ALLERGY_CLASS_WORDS: [RegExp, string[]][] = [
  [/\bnsaids?\b|non steroidal|anti inflammator/, ["nsaid"]],
  [/\bpenicillins?\b/, ["penicillin", "beta-lactam"]],
  [/beta lactam|cephalosporin|carbapenem/, ["beta-lactam"]],
  [/\baspirin\b|salicylate/, ["aspirin", "nsaid"]],
  [/\bsulf|\bsulph/, ["sulfonamide"]],
  [/\bopioids?\b|\bopiates?\b/, ["opioid"]],
  [/\btriptans?\b/, ["triptan"]],
  [/\bmacrolides?\b/, ["macrolide"]],
];

/** Drug classes in which hypersensitivity/intolerance to one member is treated as applying to the class. */
export const CROSS_REACTIVE_CLASSES = new Set(["nsaid", "salicylate", "penicillin", "beta-lactam", "cephalosporin", "sulfonamide", "macrolide", "opioid", "triptan", "ppi", "ace-inhibitor", "paracetamol"]);

export interface ResolvedAllergy { substance: string; tags: string[]; recognised: boolean; note?: string }

/** Converts a free-text allergy into allergy:<drugId|class|ingredient> tags used by drug rules and the allergy check. */
export function resolveAllergy(substance: string, idx: KnowledgeIndex): ResolvedAllergy {
  const n = normalizeText(substance);
  const tags = new Set<string>();
  for (const [re, cls] of ALLERGY_CLASS_WORDS) if (re.test(n)) cls.forEach((c) => tags.add(`allergy:${c}`));
  const med = resolveMedication(substance, idx);
  for (const id of med.drugIds) {
    tags.add(`allergy:${id}`);
    const d = idx.drug.get(id);
    if (d) tags.add(`allergy:${normalizeText(d.name)}`);
  }
  // Only pharmacological classes with recognised cross-reactivity propagate to class-level allergy tags. Therapeutic
  // categories ("analgesic", "antibiotic", "antihypertensive") must not — an ibuprofen allergy must not exclude paracetamol.
  for (const c of med.classTags) if (CROSS_REACTIVE_CLASSES.has(c)) tags.add(`allergy:${c}`);
  for (const i of med.ingredients) tags.add(`allergy:${normalizeText(i)}`);
  const recognised = tags.size > 0;
  return { substance, tags: [...tags], recognised, note: recognised ? undefined : "Allergy not matched to any drug or class in the knowledge base — check candidates manually." };
}
