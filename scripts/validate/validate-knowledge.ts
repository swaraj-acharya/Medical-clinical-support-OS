/**
 * npm run knowledge:validate [-- --file <master.json>]
 * Validates the master knowledge file: duplicate IDs, broken references, unknown patient tags in drug rules, rubric hints
 * missing from the repertory, provenance coverage, stale sources and pack checksums. Exit code 1 on any error.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { MasterKnowledge } from "../../types/knowledge";
import type { PublicumPack } from "../../types/packs";
import type { SourceRegistryEntry } from "../../types/provenance";
import { validateKnowledge } from "../../lib/knowledge/validate";
import { arg, DATA, ROOT, readJson, sha256, writeJson } from "../lib/util";

const file = arg("file") ?? path.join(DATA, "master-medical-knowledge.json");
if (!existsSync(file)) { console.error(`Missing ${file} — run npm run knowledge:build`); process.exit(1); }
const master = readJson<MasterKnowledge>(file);
const registry = readJson<{ sources: SourceRegistryEntry[] }>(path.join(DATA, "source-registry.json")).sources;
const pub = JSON.parse(gunzipSync(readFileSync(path.join(DATA, "processed/homeopathy/publicum.pack.json.gz"))).toString("utf8")) as PublicumPack;
const report = validateKnowledge(master, { registry, rubricPaths: new Set(pub.rubrics.map((r) => r[1])) });

// pack integrity: files referenced by metadata.packs must exist and match their recorded SHA-256
for (const p of master.metadata.packs) {
  const f = path.join(ROOT, p.file);
  if (!existsSync(f)) report.errors.push(`Pack missing: ${p.file}`);
  else if (sha256(readFileSync(f)) !== p.sha256) report.errors.push(`Pack checksum mismatch: ${p.file}`);
}
const out = arg("report") ?? path.join(DATA, "validation-report.json");
// keep the builder's data-quality notes when validating the same content
const prev = existsSync(out) ? readJson<{ contentHash?: string; dataQualityNotes?: string[] }>(out) : null;
writeJson(out, prev?.contentHash === report.contentHash && prev.dataQualityNotes ? { ...report, dataQualityNotes: prev.dataQualityNotes } : report);
console.log(`Knowledge v${master.metadata.version} (${master.metadata.contentHash.slice(0, 12)}…)`);
console.log(`Provenance coverage: ${report.provenance.coveragePercent}% of ${report.provenance.entitiesChecked} entities`, report.provenance.byVerification);
for (const w of report.warnings) console.log("WARN  " + w);
for (const e of report.errors) console.log("ERROR " + e);
console.log(`${report.errors.length} error(s), ${report.warnings.length} warning(s) → ${path.relative(process.cwd(), out)}`);
process.exit(report.errors.length ? 1 : 0);
