/**
 * OOREP importer.
 *
 * Source:  https://github.com/nondeterministic/oorep  (file: oorep.sql.gz, PostgreSQL dump)
 * Licence: repository GPL-3.0. The dump's own `info` table declares the "publicum" repertory
 *          (Repertorium Publicum, V. Polony 2008) as "GPL v3 - as part of the OpenRep source code".
 *          The Boericke Pocket Manual (1906) materia medica is a public-domain text by age; the
 *          transcription is distributed inside the GPL-3.0 repository.
 *
 * What this importer does:
 *  1. Uses data/imports/oorep/oorep.sql.gz if present, otherwise downloads it from GitHub.
 *  2. Parses the SQL COPY blocks directly (no database needed).
 *  3. Keeps ONLY the English "publicum" repertory (the German "kent-de" translation is skipped).
 *  4. Writes compact, gzipped packs with provenance + checksums to data/processed/homeopathy/.
 *
 * Usage: npm run import:oorep [-- --input path/to/oorep.sql.gz]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { arg, DATA, download, sha256, today, writeGzJson, writeJson } from "../lib/util";

const SOURCE_URL = "https://raw.githubusercontent.com/nondeterministic/oorep/master/oorep.sql.gz";
const REPERTORY = "publicum";

function unescapeCopy(v: string): string | null {
  if (v === "\\N") return null;
  return v.replace(/\\(\\|n|t|r)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "" : "\\"));
}

type Table = { cols: string[]; rows: (string | null)[][] };

function parseCopyBlocks(sql: string, wanted: Set<string>): Record<string, Table> {
  const out: Record<string, Table> = {};
  let current: string | null = null;
  for (const line of sql.split("\n")) {
    if (current) {
      if (line === "\\.") { current = null; continue; }
      out[current].rows.push(line.split("\t").map(unescapeCopy));
      continue;
    }
    const m = /^COPY public\.(\w+) \(([^)]*)\) FROM stdin;$/.exec(line);
    if (m && wanted.has(m[1])) {
      current = m[1];
      out[current] = { cols: m[2].split(",").map((c) => c.trim()), rows: [] };
    }
  }
  return out;
}

async function main() {
  const input = arg("input") ?? path.join(DATA, "imports", "oorep", "oorep.sql.gz");
  let gz: Buffer;
  if (existsSync(input)) {
    gz = readFileSync(input);
    console.log(`Using local dump ${input}`);
  } else {
    console.log(`Downloading ${SOURCE_URL}`);
    gz = await download(SOURCE_URL, input);
  }
  const dumpSha = sha256(gz);
  const sql = gunzipSync(gz).toString("utf8");
  const t = parseCopyBlocks(sql, new Set(["info", "remedy", "rubric", "rubricremedy", "mminfo", "mmchapter", "mmsection"]));
  const col = (tbl: Table, name: string) => tbl.cols.indexOf(name);
  const asObjects = (tbl: Table) => tbl.rows.map((r) => Object.fromEntries(tbl.cols.map((c, i) => [c, r[i]])));

  // Licence metadata straight from the dump
  const pubInfo = asObjects(t.info).find((i) => i.abbrev === REPERTORY);
  if (!pubInfo) throw new Error("publicum repertory not present in dump");
  const mmBoericke = asObjects(t.mminfo).find((m) => m.abbrev === "boericke");

  const remedies = t.remedy.rows.map((r) => {
    const alt = r[col(t.remedy, "namealt")];
    const altNames = alt ? alt.replace(/^\{|\}$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "").trim()).filter(Boolean) : [];
    return [Number(r[0]), r[1] ?? "", r[2] ?? "", altNames] as [number, string, string, string[]];
  });

  const rc = { abbrev: col(t.rubric, "abbrev"), id: col(t.rubric, "id"), fullpath: col(t.rubric, "fullpath") };
  const rubrics: [number, string][] = [];
  for (const r of t.rubric.rows) if (r[rc.abbrev] === REPERTORY && r[rc.fullpath]) rubrics.push([Number(r[rc.id]), r[rc.fullpath]!]);
  rubrics.sort((a, b) => a[1].localeCompare(b[1]));

  const rr = { abbrev: col(t.rubricremedy, "abbrev"), rubricid: col(t.rubricremedy, "rubricid"), remedyid: col(t.rubricremedy, "remedyid"), weight: col(t.rubricremedy, "weight") };
  const relations: Record<number, [number, number][]> = {};
  let relCount = 0;
  for (const r of t.rubricremedy.rows) {
    if (r[rr.abbrev] !== REPERTORY) continue;
    (relations[Number(r[rr.rubricid])] ??= []).push([Number(r[rr.remedyid]), Number(r[rr.weight])]);
    relCount++;
  }

  const repertoryMeta = {
    sourceId: "oorep",
    repertory: REPERTORY,
    title: pubInfo.title,
    author: `${pubInfo.authorfirstname} ${pubInfo.authorlastname}`,
    year: pubInfo.yearr,
    edition: pubInfo.edition,
    publisher: pubInfo.publisher,
    licenseDeclaredInDump: pubInfo.license,
    license: "GPL-3.0-or-later",
    upstream: SOURCE_URL,
    upstreamSha256: dumpSha,
    importedAt: today(),
    counts: { remedies: remedies.length, rubrics: rubrics.length, relations: relCount },
    gradeMeaning: "Repertory grade 1-3 as recorded in the source repertory (typographic emphasis convention). Not a probability or efficacy measure.",
  };
  const pub = writeGzJson(path.join(DATA, "processed", "homeopathy", "publicum.pack.json.gz"), { meta: repertoryMeta, remedies, rubrics, relations });

  const chapters = new Map<number, { remedyId: number; heading: string; sections: { heading: string; depth: number; text: string }[] }>();
  for (const r of t.mmchapter.rows) {
    if (String(r[col(t.mmchapter, "mminfo_id")]) !== String(mmBoericke?.id)) continue;
    chapters.set(Number(r[0]), { remedyId: Number(r[col(t.mmchapter, "remedy_id")]), heading: r[col(t.mmchapter, "heading")] ?? "", sections: [] });
  }
  const ms = { chap: col(t.mmsection, "mmchapter_id"), depth: col(t.mmsection, "depth"), heading: col(t.mmsection, "heading"), content: col(t.mmsection, "content"), id: col(t.mmsection, "id") };
  for (const r of [...t.mmsection.rows].sort((a, b) => Number(a[ms.id]) - Number(b[ms.id]))) {
    const ch = chapters.get(Number(r[ms.chap]));
    if (ch) ch.sections.push({ heading: r[ms.heading] ?? "", depth: Number(r[ms.depth]), text: (r[ms.content] ?? "").trim() });
  }
  const boerickeMeta = {
    sourceId: "oorep-boericke",
    title: mmBoericke?.fulltitle,
    author: `${mmBoericke?.authorfirstname} ${mmBoericke?.authorlastname}`,
    year: mmBoericke?.yearr,
    publisher: mmBoericke?.publisher,
    license: "Public-domain text (first published 1906); transcription distributed in the GPL-3.0 OOREP repository",
    upstream: SOURCE_URL,
    upstreamSha256: dumpSha,
    importedAt: today(),
    counts: { chapters: chapters.size },
  };
  const mm = writeGzJson(path.join(DATA, "processed", "homeopathy", "boericke.pack.json.gz"), { meta: boerickeMeta, entries: [...chapters.values()] });

  writeJson(path.join(DATA, "processed", "homeopathy", "manifest.json"), {
    generatedAt: new Date().toISOString(),
    packs: [
      { id: "publicum", file: "data/processed/homeopathy/publicum.pack.json.gz", sourceId: "oorep", license: repertoryMeta.license, counts: repertoryMeta.counts, sha256: pub.sha256, bytes: pub.bytes },
      { id: "boericke", file: "data/processed/homeopathy/boericke.pack.json.gz", sourceId: "oorep-boericke", license: boerickeMeta.license, counts: boerickeMeta.counts, sha256: mm.sha256, bytes: mm.bytes },
    ],
  });
  console.log(`OOREP import complete: ${JSON.stringify(repertoryMeta.counts)}; Boericke chapters ${chapters.size}; packs ${pub.bytes + mm.bytes} bytes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
