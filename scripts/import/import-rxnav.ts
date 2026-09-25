/**
 * npm run import:rxnav   (requires internet access to rxnav.nlm.nih.gov; no licence needed for these APIs)
 * Verifies each curated RXCUI: properties (name, TTY) and history status. A mismatch between the RxNorm name and the
 * curated ingredient/synonyms is reported and the drug stays "curated-pending-verification".
 */
import path from "node:path";
import type { Drug } from "../../types/knowledge";
import { DATA, readJson, today, writeJson } from "../lib/util";

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "cds-knowledge-importer/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

async function main() {
  const drugs = readJson<{ drugs: Drug[] }>(path.join(DATA, "curated/allopathy.json")).drugs;
  const results: Record<string, { rxcui: string; name: string; status: string; match: boolean }> = {};
  for (const d of drugs) {
    if (!d.rxcui) continue;
    try {
      const p = await getJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${d.rxcui}/properties.json`);
      const h = await getJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${d.rxcui}/historystatus.json`);
      const name: string = p?.properties?.name ?? "";
      const status: string = h?.rxcuiStatusHistory?.metaData?.status ?? "unknown";
      const names = [d.name, d.genericName, ...d.synonyms, ...d.composition.map((c) => c.name)].map((x) => x.toLowerCase());
      const match = Boolean(name) && names.some((n) => n.includes(name.toLowerCase()) || name.toLowerCase().includes(n));
      results[d.id] = { rxcui: d.rxcui, name, status, match: match && status === "Active" };
      console.log(`${match ? "✓" : "✗"} ${d.id} RXCUI ${d.rxcui} → ${name} (${status})`);
    } catch (e) {
      console.warn(`✗ ${d.id}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!Object.keys(results).length) { console.error("No RxNav responses (network unavailable?). Nothing written."); process.exit(1); }
  writeJson(path.join(DATA, "processed/allopathy/rxnorm-verification.json"), { checkedAt: today(), source: "RxNav REST API (NLM)", results });
  console.log("Wrote processed/allopathy/rxnorm-verification.json — run npm run knowledge:update to stage a rebuild.");
}
main();
