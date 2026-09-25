/** npm run docs:sources — regenerates DATA_SOURCES.md from data/source-registry.json (single source of truth). */
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { SourceRegistryEntry } from "../../types/provenance";
import { DATA, readJson, ROOT } from "../lib/util";

const reg = readJson<{ generatedAt?: string; sources: SourceRegistryEntry[] }>(path.join(DATA, "source-registry.json")).sources;
const esc = (s: string | null | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const INTEGRATION: Record<string, string> = {
  "bundled-import": "Imported and bundled", "bundled-subset": "Subset bundled", "api-adapter": "API adapter", "user-supplied-import": "User-supplied file",
  "metadata-only": "Metadata only", "reference-link": "Reference link", "architecture-reference": "Design reference",
};
const groups: [string, string][] = [["shared", "Shared / safety / interoperability"], ["allopathy", "Allopathy"], ["ayurveda", "Ayurveda"], ["homeopathy", "Homeopathy"]];
let md = `# Data sources\n\nGenerated from \`data/source-registry.json\` by \`npm run docs:sources\`. ${reg.length} sources. The registry is the single source of truth; this file is a readable view.\n\n`;
md += `**Authority levels** (lower = more authoritative): 1 official, regulatory and national/international clinical bodies and standards; 2 curated scientific databases and datasets; 3 research literature; 4 structured open datasets, knowledge graphs and this project's curated layer; 5 community / open-source projects (architecture reference or validated before use); 6 general websites.\n\n`;
md += `**How used:** *Imported and bundled* — data is in this repository; *API adapter* — importer script that runs on a networked machine; *User-supplied file* — licence prevents redistribution, the user imports their own copy; *Reference link / Metadata only* — cited, no content copied; *Design reference* — informed architecture only.\n\n`;
for (const [sys, title] of groups) {
  const rows = reg.filter((s) => s.system === sys).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  if (!rows.length) continue;
  md += `## ${title}\n\n| Source | Level | Data licence | Commercial use | How used | Data copied | Status | Checked |\n|---|---|---|---|---|---|---|---|\n`;
  for (const s of rows) md += `| [${esc(s.name)}](${/^https?:/.test(s.url) ? s.url : `./${s.url}`}) \`${s.id}\` | ${s.level} | ${esc(s.dataLicense)} | ${s.commercialUse} | ${INTEGRATION[s.integration]} | ${s.dataCopied ? "yes" : "no"} | ${s.status} | ${s.lastChecked} |\n`;
  md += "\n";
}
md += `## Notes per source\n\n`;
for (const s of [...reg].sort((a, b) => a.id.localeCompare(b.id))) {
  md += `### ${s.name} (\`${s.id}\`)\n\n${esc(s.description)}\n\n- Recommended use: ${esc(s.recommendedUse)}\n- Fields used: ${s.importedFields.length ? esc(s.importedFields.join(", ")) : "none"}\n- Redistribution: ${s.redistribution}${s.attributionRequired ? `; attribution required${s.attributionText ? ` — “${esc(s.attributionText)}”` : ""}` : ""}\n- Update frequency: ${esc(s.updateFrequency)}\n${s.notes ? `- Notes: ${esc(s.notes)}\n` : ""}\n`;
}
writeFileSync(path.join(ROOT, "DATA_SOURCES.md"), md);
console.log(`DATA_SOURCES.md written (${reg.length} sources).`);
