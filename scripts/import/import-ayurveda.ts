/**
 * Ayurveda dataset importer (Amidha Ayurveda open datasets by S. Varshney, all CC BY 4.0).
 *
 *  - Herb Database v2.0          https://github.com/sciencewithsaucee-sudo/herb-database          DOI 10.5281/zenodo.17475351
 *  - Bhaishajya Kalpana Kosha    https://github.com/sciencewithsaucee-sudo/Bhaishajya-Kalpana-Kosha DOI 10.5281/zenodo.18243950
 *  - Siddhanta Kosha             https://github.com/sciencewithsaucee-sudo/Siddhanta-Kosha        DOI 10.5281/zenodo.17481343
 *
 * Source level 4 (structured open-source dataset, single curator, not peer reviewed). Every record keeps
 * provenance. Promotional free text ("preview") and image links are intentionally NOT imported.
 * Usage: npm run import:ayurveda  (uses data/imports/ayurveda/*.json if present, otherwise downloads)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DATA, download, sha256, slug, today, writeJson } from "../lib/util";

const FILES = {
  herbs: { url: "https://raw.githubusercontent.com/sciencewithsaucee-sudo/herb-database/main/herb.json", local: "herb.json", sourceId: "amidha-herb-db" },
  formulations: { url: "https://raw.githubusercontent.com/sciencewithsaucee-sudo/Bhaishajya-Kalpana-Kosha/main/Bhaishajya-Kalpana-Kosha.json", local: "Bhaishajya-Kalpana-Kosha.json", sourceId: "bhaishajya-kalpana-kosha" },
  principles: { url: "https://raw.githubusercontent.com/sciencewithsaucee-sudo/Siddhanta-Kosha/main/Siddhanta-Kosha.json", local: "Siddhanta-Kosha.json", sourceId: "siddhanta-kosha" },
} as const;

/** Mineral / metal / arsenical ingredients (Rasaushadhi) — triggers a mandatory safety flag. */
export const MINERAL_METAL_MARKERS = ["parada", "gandhaka", "hingula", "abhraka", "loha", "lauh", "tamra", "naga", "vanga", "swarna", "rajata", "yashada", "mandura", "kajjali", "rasa sindura", "makshika", "manashila", "haratala", "gairika", "tankana", "pravala", "godanti", "shankha bhasma", "mukta pishti", "kasis", "shilajit", "bhasma", "pishti"];
/** Word-boundary match so e.g. "vanga" (tin) does not match "Lavanga" (clove). */
export const MINERAL_METAL_RE = new RegExp(`\\b(${MINERAL_METAL_MARKERS.join("|")})\\b`, "i");

async function load(key: keyof typeof FILES): Promise<{ rows: any[]; sha: string }> {
  const f = FILES[key];
  const local = path.join(DATA, "imports", "ayurveda", f.local);
  const buf = existsSync(local) ? readFileSync(local) : await download(f.url, local);
  return { rows: JSON.parse(buf.toString("utf8")), sha: sha256(buf) };
}

function splitIndications(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\(([^)]+)\)/g)) m[1].split(/[,/&]| and /).forEach((t) => t.trim() && out.add(t.trim()));
  text.replace(/\([^)]*\)/g, "").split(/[,.;]/).forEach((t) => { const s = t.trim(); if (s && s.length < 60) out.add(s); });
  return [...out];
}

async function main() {
  const [herbs, forms, prins] = await Promise.all([load("herbs"), load("formulations"), load("principles")]);
  const verified = today();

  const herbOut = herbs.rows.map((h) => ({
    id: `herb_${slug(h.name)}`,
    name: h.name,
    botanicalName: h.botanical_name ?? "",
    family: h.family ?? "",
    englishName: h.english_name ?? "",
    sanskritSynonyms: h.sanskrit_synonyms ?? [],
    partUsed: h.part_used ?? [],
    mainIndications: h.main_indications ?? [],
    pacifies: (h.pacify ?? []).map((d: string) => (d.toLowerCase() === "tridosha" ? "Tridosha" : d)),
    aggravates: h.aggravate ?? [],
    tridosha: Boolean(h.tridosha),
    rasa: h.rasa ?? [],
    guna: h.guna ?? [],
    virya: h.virya ?? "",
    vipaka: h.vipaka ?? "",
    prabhava: (h.prabhav ?? []).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)),
    safetyNotes: [],
    modernEvidence: [],
    sources: [{ sourceId: FILES.herbs.sourceId, reference: h.name, url: h.link || "https://github.com/sciencewithsaucee-sudo/herb-database", version: "2.0.0", lastVerified: verified }],
    verification: "imported-from-source",
  }));

  const herbByName = new Map<string, string>();
  for (const h of herbOut) {
    herbByName.set(h.name.toLowerCase(), h.id);
    for (const s of h.sanskritSynonyms) if (!herbByName.has(s.toLowerCase())) herbByName.set(s.toLowerCase(), h.id);
  }

  const formOut = forms.rows.map((f) => {
    const hay = `${f.name} ${f.ingredients} ${f.type}`;
    const mineral = f.type === "Bhasma/Pishti" || /\brasa\b/i.test(f.name) || MINERAL_METAL_RE.test(hay);
    return {
      id: `form_${slug(f.name)}`,
      name: f.name,
      formulationType: f.type,
      category: f.category,
      mainIngredients: f.main_ingredients ?? [],
      ingredientHerbIds: (f.main_ingredients ?? []).map((n: string) => herbByName.get(n.toLowerCase())).filter(Boolean),
      ingredientsText: f.ingredients ?? "",
      indicationsText: f.indications ?? "",
      indicationTerms: splitIndications(f.indications ?? ""),
      classicalReference: f.reference ?? "",
      sourceReportedDose: f.dosage || null,
      anupana: f.anupana || null,
      containsMineralsOrMetals: mineral,
      safetyNotes: [],
      modernEvidence: [],
      sources: [{ sourceId: FILES.formulations.sourceId, reference: f.name, url: "https://doi.org/10.5281/zenodo.18243950", version: "1.0.0", lastVerified: verified }],
      verification: "imported-from-source",
    };
  });

  const prinOut = prins.rows.map((p) => ({
    id: `prin_${slug(p.name)}`,
    name: p.name,
    category: p.category,
    shloka: p.shloka || null,
    shlokaRef: p.shloka_ref || null,
    explanation: p.explanation ?? "",
    clinicalImportance: p.clinical_importance || null,
    sources: [{ sourceId: FILES.principles.sourceId, reference: p.name, url: "https://doi.org/10.5281/zenodo.17481343", version: "1.0.0", lastVerified: verified }],
    verification: "imported-from-source",
  }));

  const dir = path.join(DATA, "processed", "ayurveda");
  writeJson(path.join(dir, "herbs.json"), herbOut);
  writeJson(path.join(dir, "formulations.json"), formOut);
  writeJson(path.join(dir, "principles.json"), prinOut);
  writeJson(path.join(dir, "manifest.json"), {
    generatedAt: new Date().toISOString(),
    inputs: { herbs: herbs.sha, formulations: forms.sha, principles: prins.sha },
    counts: { herbs: herbOut.length, formulations: formOut.length, principles: prinOut.length, formulationsWithMineralsOrMetals: formOut.filter((f) => f.containsMineralsOrMetals).length, formulationIngredientsLinkedToHerbs: formOut.reduce((n, f) => n + f.ingredientHerbIds.length, 0) },
    excludedFields: ["herb.preview (promotional prose)", "herb.image"],
    license: "CC BY 4.0 — attribution: Varshney S., Amidha Ayurveda open datasets (see DATA_LICENSES.md)",
  });
  console.log(`Ayurveda import complete: ${herbOut.length} herbs, ${formOut.length} formulations, ${prinOut.length} principles`);
}

main().catch((e) => { console.error(e); process.exit(1); });
