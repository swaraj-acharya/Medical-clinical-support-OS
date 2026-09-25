/**
 * Server-side knowledge access. Everything is read from ./data at runtime and cached in-process.
 * Never import this from a client component.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { MasterKnowledge } from "../../types/knowledge";
import type { BoerickePack, PublicumPack } from "../../types/packs";
import type { SourceRegistryEntry } from "../../types/provenance";
import type { ValidationReport } from "./validate";
import { normalizeText } from "../normalize/text";

export const DATA_DIR = path.join(process.cwd(), "data");

let master: MasterKnowledge | null = null;
let registry: SourceRegistryEntry[] | null = null;

export function getKnowledge(): MasterKnowledge {
  if (!master) {
    const file = path.join(DATA_DIR, "master-medical-knowledge.json");
    if (!existsSync(file)) throw new Error("Knowledge base missing: run `npm run knowledge:build`.");
    master = JSON.parse(readFileSync(file, "utf8")) as MasterKnowledge;
  }
  return master;
}

export function getRegistry(): SourceRegistryEntry[] {
  if (!registry) registry = (JSON.parse(readFileSync(path.join(DATA_DIR, "source-registry.json"), "utf8")) as { sources: SourceRegistryEntry[] }).sources;
  return registry;
}

export function getValidationReport(): (ValidationReport & { dataQualityNotes?: string[] }) | null {
  const f = path.join(DATA_DIR, "validation-report.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

/** Test hook: drop caches (e.g., after rebuilding the KB). */
export function resetKnowledgeCache() {
  master = null;
  registry = null;
  repertory = null;
  materia = null;
}

// ---------------------------------------------------------------- repertory pack

export interface RubricNode { id: string; oorepId: number; path: string; label: string; chapter: string; depth: number; parentPath: string | null; childCount: number; remedyCount: number }

export interface RepertoryIndex {
  meta: PublicumPack["meta"];
  remedies: Map<number, { id: string; abbrev: string; name: string }>;
  remedyByAbbrev: Map<string, number>;
  pathById: Map<number, string>;
  idByPath: Map<string, number>;
  children: Map<string, number[]>; // parentPath ("" = root) → child rubric ids
  relations: PublicumPack["relations"];
  chapters: { name: string; rubricCount: number }[];
  normPaths: [number, string][];
}

let repertory: RepertoryIndex | null = null;

export function getRepertory(): RepertoryIndex {
  if (repertory) return repertory;
  const pack = JSON.parse(gunzipSync(readFileSync(path.join(DATA_DIR, "processed/homeopathy/publicum.pack.json.gz"))).toString("utf8")) as PublicumPack;
  const idByPath = new Map<string, number>();
  const pathById = new Map<number, string>();
  for (const [id, p] of pack.rubrics) { idByPath.set(p, id); pathById.set(id, p); }
  const children = new Map<string, number[]>();
  const chapterCounts = new Map<string, number>();
  for (const [id, p] of pack.rubrics) {
    const segs = p.split(", ");
    chapterCounts.set(segs[0], (chapterCounts.get(segs[0]) ?? 0) + 1);
    let parent = "";
    for (let i = segs.length - 1; i >= 1; i--) {
      const a = segs.slice(0, i).join(", ");
      if (idByPath.has(a)) { parent = a; break; }
    }
    if (segs.length === 1) parent = "";
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  for (const [k, v] of children) v.sort((a, b) => pathById.get(a)!.localeCompare(pathById.get(b)!));
  repertory = {
    meta: pack.meta,
    remedies: new Map(pack.remedies.map(([id, abbrev, name]) => [id, { id: `rem_${id}`, abbrev, name }])),
    remedyByAbbrev: new Map(pack.remedies.map(([id, abbrev]) => [abbrev, id])),
    pathById,
    idByPath,
    children,
    relations: pack.relations,
    chapters: [...chapterCounts.entries()].map(([name, rubricCount]) => ({ name, rubricCount })).sort((a, b) => a.name.localeCompare(b.name)),
    normPaths: pack.rubrics.map(([id, p]) => [id, normalizeText(p)]),
  };
  return repertory;
}

export function rubricNode(r: RepertoryIndex, oorepId: number): RubricNode | null {
  const p = r.pathById.get(oorepId);
  if (!p) return null;
  const segs = p.split(", ");
  let parentPath: string | null = null;
  for (let i = segs.length - 1; i >= 1; i--) { const a = segs.slice(0, i).join(", "); if (r.idByPath.has(a)) { parentPath = a; break; } }
  return {
    id: `pub_${oorepId}`, oorepId, path: p, label: parentPath ? p.slice(parentPath.length + 2) : p, chapter: segs[0], depth: segs.length,
    parentPath, childCount: r.children.get(p)?.length ?? 0, remedyCount: r.relations[String(oorepId)]?.length ?? 0,
  };
}

/** Parses "pub_123" → 123 (or null). */
export function parseRubricId(id: string): number | null {
  const m = /^pub_(\d{1,9})$/.exec(id);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------- materia medica pack

let materia: Map<number, BoerickePack["entries"][number]> | null = null;
let materiaMeta: BoerickePack["meta"] | null = null;

export function getMateriaMedica() {
  if (!materia) {
    const pack = JSON.parse(gunzipSync(readFileSync(path.join(DATA_DIR, "processed/homeopathy/boericke.pack.json.gz"))).toString("utf8")) as BoerickePack;
    materia = new Map(pack.entries.map((e) => [e.remedyId, e]));
    materiaMeta = pack.meta;
  }
  return { entries: materia, meta: materiaMeta! };
}
