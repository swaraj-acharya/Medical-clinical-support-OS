/**
 * npm run knowledge:update [-- --import] [-- --version 1.1.0] [-- --promote]
 *
 * Safe update workflow — never silently overwrites the live knowledge base:
 *   1. (optional --import) re-run the local importers (OOREP, Ayurveda datasets)
 *   2. build a candidate master into data/staging/
 *   3. validate it (errors abort)
 *   4. diff against the live master (counts, added/removed IDs, content hash) → data/staging/update-report.json
 *   5. only with --promote: back up the live file to data/backups/ and replace it
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { MasterKnowledge } from "../types/knowledge";
import type { PublicumPack } from "../types/packs";
import type { SourceRegistryEntry } from "../types/provenance";
import { validateKnowledge } from "../lib/knowledge/validate";
import { buildMaster, KB_VERSION } from "./build-knowledge-base/build-master-knowledge";
import { arg, DATA, ensureDir, flag, readJson, ROOT, writeJson } from "./lib/util";

const live = path.join(DATA, "master-medical-knowledge.json");
const stagingDir = path.join(DATA, "staging");
ensureDir(stagingDir);

if (flag("import")) {
  for (const s of ["scripts/import/import-oorep.ts", "scripts/import/import-ayurveda.ts"]) {
    console.log(`▶ ${s}`);
    execFileSync(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), s], { cwd: ROOT, stdio: "inherit" });
  }
}

const version = arg("version") ?? KB_VERSION;
const { master, dataQuality } = buildMaster(version);
const stagedFile = path.join(stagingDir, "master-medical-knowledge.json");
writeJson(stagedFile, master, false);
const registry = readJson<{ sources: SourceRegistryEntry[] }>(path.join(DATA, "source-registry.json")).sources;
const pub = JSON.parse(gunzipSync(readFileSync(path.join(DATA, "processed/homeopathy/publicum.pack.json.gz"))).toString("utf8")) as PublicumPack;
const report = validateKnowledge(master, { registry, rubricPaths: new Set(pub.rubrics.map((r) => r[1])) });

const diff: Record<string, { before: number; after: number; added: string[]; removed: string[] }> = {};
let old: MasterKnowledge | null = existsSync(live) ? readJson<MasterKnowledge>(live) : null;
if (old) {
  for (const [k, v] of Object.entries(master)) {
    if (!Array.isArray(v)) continue;
    const before = (old as unknown as Record<string, unknown[]>)[k] ?? [];
    const ids = (xs: unknown[]) => new Set(xs.map((x) => (x as { id?: string }).id).filter(Boolean) as string[]);
    const a = ids(v);
    const b = ids(before);
    const added = [...a].filter((x) => !b.has(x));
    const removed = [...b].filter((x) => !a.has(x));
    if (before.length !== v.length || added.length || removed.length) diff[k] = { before: before.length, after: v.length, added: added.slice(0, 50), removed: removed.slice(0, 50) };
  }
}
const changed = !old || old.metadata.contentHash !== master.metadata.contentHash;
const updateReport = {
  generatedAt: new Date().toISOString(),
  liveVersion: old?.metadata.version ?? null,
  liveContentHash: old?.metadata.contentHash ?? null,
  candidateVersion: master.metadata.version,
  candidateContentHash: master.metadata.contentHash,
  contentChanged: changed,
  versionBumpNeeded: Boolean(old && changed && old.metadata.version === master.metadata.version),
  validation: { errors: report.errors, warnings: report.warnings, provenance: report.provenance },
  dataQualityNotes: dataQuality,
  diff,
};
writeJson(path.join(stagingDir, "update-report.json"), updateReport);
console.log(`Candidate v${master.metadata.version} ${changed ? "differs from" : "is identical to"} live ${old?.metadata.version ?? "(none)"}; ${Object.keys(diff).length} collection(s) changed.`);
for (const [k, d] of Object.entries(diff)) console.log(`  ${k}: ${d.before} → ${d.after} (+${d.added.length} / -${d.removed.length})`);
if (report.errors.length) { console.error(`Validation failed (${report.errors.length} errors) — not promoting.`); report.errors.forEach((e) => console.error("  " + e)); process.exit(1); }
if (!flag("promote")) { console.log("Staged only. Review data/staging/update-report.json, then re-run with --promote."); process.exit(0); }
if (updateReport.versionBumpNeeded) { console.error("Content changed but version did not: pass --version <new> to promote."); process.exit(1); }
if (old) {
  const backups = path.join(DATA, "backups");
  ensureDir(backups);
  copyFileSync(live, path.join(backups, `master-${old.metadata.version}-${old.metadata.contentHash.slice(0, 8)}.json`));
}
copyFileSync(stagedFile, live);
writeJson(path.join(DATA, "validation-report.json"), { ...report, dataQualityNotes: dataQuality });
console.log(`Promoted v${master.metadata.version}. Restart the app (or use Admin → reload) to serve the new knowledge base.`);
old = null;
