import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { validateKnowledge } from "../../lib/knowledge/validate";
import { getKnowledge, getRegistry } from "../../lib/knowledge/store";
import type { PublicumPack } from "../../types/packs";

describe("master knowledge base", () => {
  const kb = getKnowledge();
  it("validates with zero errors and full provenance coverage", () => {
    const pub = JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(), "data/processed/homeopathy/publicum.pack.json.gz"))).toString("utf8")) as PublicumPack;
    const r = validateKnowledge(kb, { registry: getRegistry(), rubricPaths: new Set(pub.rubrics.map((x) => x[1])) });
    expect(r.errors).toEqual([]);
    expect(r.provenance.coveragePercent).toBe(100);
  });
  it("every source referenced by an entity exists in the registry with a licence", () => {
    const reg = new Map(getRegistry().map((s) => [s.id, s]));
    const refs = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") { const o = v as Record<string, unknown>; if (typeof o.sourceId === "string") refs.add(o.sourceId); Object.values(o).forEach(walk); }
    };
    walk({ drugs: kb.drugs, redFlags: kb.redFlags, conditions: kb.conditions, recs: kb.guidelineRecommendations, herbs: kb.ayurvedicHerbs.slice(0, 50) });
    for (const id of refs) { expect(reg.has(id), id).toBe(true); expect(reg.get(id)!.dataLicense.length).toBeGreaterThan(0); }
  });
  it("keeps allopathy drug facts marked pending verification until importers verify them", () => {
    expect(kb.drugs.every((d) => ["curated-pending-verification", "curated-verified"].includes(d.verification))).toBe(true);
  });
  it("records version and content hash metadata", () => {
    expect(kb.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(kb.metadata.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
