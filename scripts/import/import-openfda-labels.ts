/**
 * npm run import:openfda   (requires internet access to api.fda.gov; optional OPENFDA_API_KEY)
 * For every curated drug, fetches the most recent SPL label from openFDA and records set ID, effective date and which
 * safety sections are present. The KB builder attaches this as verification provenance. Label text is NOT copied —
 * clinicians follow the DailyMed link. Nothing is written if the network is unavailable.
 */
import path from "node:path";
import type { Drug } from "../../types/knowledge";
import { DATA, readJson, today, writeJson } from "../lib/util";

const SECTIONS = ["boxed_warning", "contraindications", "warnings_and_cautions", "warnings", "drug_interactions", "adverse_reactions", "pregnancy", "lactation", "use_in_specific_populations"];

async function main() {
  const drugs = readJson<{ drugs: Drug[] }>(path.join(DATA, "curated/allopathy.json")).drugs;
  const key = process.env.OPENFDA_API_KEY ? `&api_key=${encodeURIComponent(process.env.OPENFDA_API_KEY)}` : "";
  const labels: Record<string, unknown> = {};
  const failures: string[] = [];
  for (const d of drugs) {
    const usName = d.synonyms.includes("acetaminophen") ? "acetaminophen" : d.composition[0]?.name ?? d.name;
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${encodeURIComponent(usName)}%22&sort=effective_time:desc&limit=1${key}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "cds-knowledge-importer/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { results?: Record<string, any>[] };
      const r = j.results?.[0];
      if (!r) throw new Error("no label");
      const setId = r.set_id as string;
      labels[d.id] = {
        setId, effectiveTime: r.effective_time, title: (r.openfda?.brand_name?.[0] ?? usName) + (r.openfda?.manufacturer_name?.[0] ? ` — ${r.openfda.manufacturer_name[0]}` : ""),
        sectionsPresent: SECTIONS.filter((s) => Array.isArray(r[s]) && r[s].length), url: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${setId}`,
      };
      console.log(`✓ ${d.id} → ${setId}`);
    } catch (e) {
      failures.push(`${d.id}: ${e instanceof Error ? e.message : e}`);
      console.warn(`✗ ${d.id}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!Object.keys(labels).length) { console.error("No labels fetched (network unavailable?). Nothing written."); process.exit(1); }
  writeJson(path.join(DATA, "processed/allopathy/openfda-labels.json"), { fetchedAt: today(), source: "openFDA drug/label endpoint", failures, labels });
  console.log(`Wrote ${Object.keys(labels).length} label records. Run npm run knowledge:update to stage a rebuild.`);
}
main();
