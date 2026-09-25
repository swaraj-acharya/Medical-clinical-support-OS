/**
 * npm run import:user -- --atc <file.csv>        CSV columns: drugId,atcCode   (WHO ATC/DDD — licence held by the user)
 * npm run import:user -- --namaste <file.csv>    CSV columns: code,term,display (NAMASTE export obtained by the user)
 * These datasets are not redistributable with this project, so they are imported only from files the user supplies.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, DATA, today, writeJson } from "../lib/util";

function csv(file: string): string[][] {
  if (!existsSync(file)) throw new Error(`File not found: ${file}`);
  return readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
}

const atc = arg("atc");
const namaste = arg("namaste");
if (!atc && !namaste) { console.error("Usage: --atc <file.csv> | --namaste <file.csv>"); process.exit(1); }
if (atc) {
  const rows = csv(atc).filter((r) => /^drug_[a-z0-9_]+$/.test(r[0]) && /^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(r[1] ?? ""));
  const codes: Record<string, string[]> = {};
  for (const [drugId, code] of rows) codes[drugId] = [...new Set([...(codes[drugId] ?? []), code])];
  writeJson(path.join(DATA, "processed/allopathy/atc-user-supplied.json"), { importedAt: today(), file: path.basename(atc), licenceNote: "User-supplied WHO ATC codes — do not redistribute", codes });
  console.log(`ATC: ${rows.length} valid rows for ${Object.keys(codes).length} drugs.`);
}
if (namaste) {
  const rows = csv(namaste).filter((r) => r.length >= 3 && r[0]);
  writeJson(path.join(DATA, "processed/ayurveda/namaste-user-supplied.json"), { importedAt: today(), file: path.basename(namaste), licenceNote: "User-supplied NAMASTE codes — check Ministry of AYUSH terms", codes: rows.map(([code, term, display]) => ({ code, term, display })) });
  console.log(`NAMASTE: ${rows.length} codes stored (not auto-mapped).`);
}
