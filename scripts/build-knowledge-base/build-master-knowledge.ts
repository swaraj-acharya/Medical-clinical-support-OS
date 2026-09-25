/**
 * Builds data/master-medical-knowledge.json — the canonical normalized knowledge layer.
 *
 *   npm run knowledge:build                 → writes data/master-medical-knowledge.json
 *   npm run knowledge:build -- --out <file> → writes elsewhere (used by knowledge:update staging)
 *
 * Inputs (all local, all licence-checked — see DATA_LICENSES.md):
 *   data/curated/*.json              hand-curated, provenance on every entity
 *   data/processed/ayurveda/*.json   importer output (CC BY 4.0, Varshney/Amidha)
 *   data/processed/homeopathy/*.gz   importer output (OOREP, GPL-3.0)
 *   data/source-registry.json
 * Deterministic: the same inputs give the same contentHash (generatedAt is excluded from the hash).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type {
  AyurvedicFormulation, AyurvedicHerb, AyurvedicPrinciple, BodySystem, ClinicalContext, ClinicalGuideline, Drug, DrugInteraction,
  GraphEdge, GuidelineRecommendation, HistoryCondition, MasterKnowledge, RedFlagRule, RepertoryRubric, SymptomConcept, TerminologyMapping,
} from "../../types/knowledge";
import type { SourceRegistryEntry } from "../../types/provenance";
import type { BoerickePack, PublicumPack } from "../../types/packs";
import { validateKnowledge } from "../../lib/knowledge/validate";
import { arg, DATA, readJson, sha256, slug, today, writeJson } from "../lib/util";

export const KB_VERSION = "1.0.0";

const cur = (f: string) => readJson<any>(path.join(DATA, "curated", f));
const opt = <T>(rel: string): T | null => (existsSync(path.join(DATA, rel)) ? readJson<T>(path.join(DATA, rel)) : null);
const gz = <T>(f: string): T => JSON.parse(gunzipSync(readFileSync(path.join(DATA, f))).toString("utf8")) as T;

export function buildMaster(version: string = KB_VERSION): { master: MasterKnowledge; dataQuality: string[] } {
  const dq: string[] = [];
  const registry = readJson<{ sources: SourceRegistryEntry[] }>(path.join(DATA, "source-registry.json")).sources;
  const symptoms = cur("symptoms.json") as SymptomConcept[];
  const bodySystems = cur("body-systems.json") as BodySystem[];
  const rf = cur("red-flags.json") as { rules: RedFlagRule[]; checklist: { id: string; label: string; appliesTo: string[] }[] };
  const allo = cur("allopathy.json") as {
    guidelines: ClinicalGuideline[]; contexts: ClinicalContext[]; recommendations: GuidelineRecommendation[]; drugs: Drug[];
    interactions: DrugInteraction[]; historyConditions: HistoryCondition[]; knowledge: MasterKnowledge["allopathicKnowledge"]; studies: MasterKnowledge["clinicalStudies"];
  };
  const ayB = cur("ayurveda-bridge.json");
  const ho = cur("homeopathy.json");

  // ---------------- Ayurveda (imported) ----------------
  const herbs = readJson<AyurvedicHerb[]>(path.join(DATA, "processed/ayurveda/herbs.json"));
  const formsRaw = readJson<AyurvedicFormulation[]>(path.join(DATA, "processed/ayurveda/formulations.json"));
  const principles = readJson<AyurvedicPrinciple[]>(path.join(DATA, "processed/ayurveda/principles.json"));
  const seen = new Set<string>();
  const forms: AyurvedicFormulation[] = [];
  for (const f of formsRaw) {
    if (seen.has(f.id)) { dq.push(`Duplicate formulation id in source dataset: ${f.id} (first record kept)`); continue; }
    seen.add(f.id); forms.push(f);
  }
  // attach curated herb safety notes (LiverTox etc.)
  for (const hs of ayB.herbSafety as { herbId: string; note: AyurvedicHerb["safetyNotes"][number] }[]) {
    const h = herbs.find((x) => x.id === hs.herbId);
    if (!h) { dq.push(`Herb safety note references unknown herb ${hs.herbId}`); continue; }
    if (!h.safetyNotes.some((n) => n.id === hs.note.id)) h.safetyNotes.push(hs.note);
  }

  // Rasaushadhi (mineral/metal) and ingredient-level herb safety notes are attached to formulations
  const ras = ayB.generalSafety.rasaushadhi;
  const herbNotes = new Map((ayB.herbSafety as { herbId: string; note: AyurvedicHerb["safetyNotes"][number] }[]).map((h) => [h.herbId, h.note]));
  for (const f of forms) {
    if (f.containsMineralsOrMetals && !f.safetyNotes.some((n) => n.id === ras.id)) f.safetyNotes.push({ id: ras.id, text: ras.text, level: "high-risk", source: ras.source });
    for (const hid of f.ingredientHerbIds) {
      const n = herbNotes.get(hid);
      if (n && !f.safetyNotes.some((x) => x.id === `${n.id}__ingredient`)) f.safetyNotes.push({ ...n, id: `${n.id}__ingredient`, level: "review", text: `Ingredient ${hid.replace("herb_", "")}: ${n.text}` });
    }
  }

  // ---------------- Homeopathy (imported packs) ----------------
  const manifest = readJson<{ packs: { id: string; file: string; sourceId: string; license: string; counts: Record<string, number>; sha256: string }[] }>(path.join(DATA, "processed/homeopathy/manifest.json"));
  const pub = gz<PublicumPack>("processed/homeopathy/publicum.pack.json.gz");
  const boer = gz<BoerickePack>("processed/homeopathy/boericke.pack.json.gz");
  const remedies = pub.remedies.map(([id, abbrev, name, alt]) => ({ id: `rem_${id}`, oorepId: id, abbrev, name, altNames: alt }));
  const byAbbrev = new Map(remedies.map((r) => [r.abbrev, r]));
  const toxic = (ho.toxicSource as { abbrev: string; material: string; note: string; sources: any[] }[]).map((t) => {
    const r = byAbbrev.get(t.abbrev);
    if (!r) dq.push(`Toxic-source flag references abbreviation not in repertory: ${t.abbrev}`);
    else (r as any).toxicSource = t.material;
    return { ...t, remedyId: r ? r.id : null };
  });
  const pathToId = new Map(pub.rubrics.map(([id, p]) => [p, id]));
  const hintPaths = new Set<string>([...Object.values(ho.symptomRubrics as Record<string, string[]>).flat(), ...(ho.modifierRubrics as { rubric: string }[]).map((m) => m.rubric)]);
  const withAncestors = new Set<string>();
  for (const p of hintPaths) {
    if (!pathToId.has(p)) dq.push(`Rubric hint not found in repertory: ${p}`);
    const segs = p.split(", ");
    for (let i = 1; i <= segs.length; i++) { const a = segs.slice(0, i).join(", "); if (pathToId.has(a)) withAncestors.add(a); }
  }
  const rubricEntity = (p: string): RepertoryRubric => {
    const segs = p.split(", ");
    let parent: string | null = null;
    for (let i = segs.length - 1; i >= 1; i--) { const a = segs.slice(0, i).join(", "); if (pathToId.has(a)) { parent = a; break; } }
    return { id: `pub_${pathToId.get(p)}`, repertory: "publicum", path: p, chapter: segs[0], depth: segs.length, parentPath: parent };
  };
  const homeopathyRubrics = [...withAncestors].sort().map(rubricEntity);
  const homeopathyRubricRemedyRelations = homeopathyRubrics
    .filter((r) => hintPaths.has(r.path))
    .flatMap((r) => (pub.relations[String(pathToId.get(r.path))] ?? []).map(([rem, g]) => ({ rubricId: r.id, remedyId: `rem_${rem}`, grade: g as 1 | 2 | 3 })));
  const homeopathyMateriaMedica = boer.entries.map((e) => ({ remedyId: `rem_${e.remedyId}`, source: "oorep-boericke", headings: e.sections.map((s) => s.heading) }));

  // ---------------- Allopathy: merge OPTIONAL importer outputs (network / user-supplied) ----------------
  const openfda = opt<{ fetchedAt: string; labels: Record<string, { setId: string; effectiveTime: string; title: string; sectionsPresent: string[]; url: string }> }>("processed/allopathy/openfda-labels.json");
  const rxver = opt<{ checkedAt: string; results: Record<string, { rxcui: string; name: string; status: string; match: boolean }> }>("processed/allopathy/rxnorm-verification.json");
  const atc = opt<{ importedAt: string; codes: Record<string, string[]> }>("processed/allopathy/atc-user-supplied.json");
  for (const d of allo.drugs) {
    const lab = openfda?.labels?.[d.id];
    if (lab) d.sources.push({ sourceId: "openfda", reference: `SPL set ${lab.setId} — ${lab.title}; sections present: ${lab.sectionsPresent.join(", ")}`, url: lab.url, version: lab.effectiveTime, lastVerified: openfda!.fetchedAt });
    const rv = rxver?.results?.[d.id];
    if (rv) {
      d.sources.push({ sourceId: "rxnorm", reference: `RxNav check: RXCUI ${rv.rxcui} status '${rv.status}', name '${rv.name}' — ${rv.match ? "matches curated ingredient" : "MISMATCH, review"}`, lastVerified: rxver!.checkedAt });
      if (!rv.match) dq.push(`RxNav verification mismatch for ${d.id} (RXCUI ${rv.rxcui})`);
    }
    if (rv?.match && lab) d.verification = "curated-verified";
    if (atc?.codes?.[d.id]) (d as Drug & { atcCodes?: string[] }).atcCodes = atc.codes[d.id];
  }
  const namaste = opt<{ importedAt: string; codes: { code: string; term: string; display: string }[] }>("processed/ayurveda/namaste-user-supplied.json");
  if (namaste) dq.push(`NAMASTE user-supplied file present (${namaste.codes.length} codes, imported ${namaste.importedAt}); codes are not auto-mapped — mapping requires clinical review.`);
  if (!openfda) dq.push("openFDA label verification not present (run npm run import:openfda on a networked machine)");
  if (!rxver) dq.push("RxNav RXCUI verification not present (run npm run import:rxnav on a networked machine)");

  // ---------------- Allopathy derived tables ----------------
  const drugIngredients = new Map<string, { id: string; name: string; rxcui: string | null }>();
  for (const d of allo.drugs) for (const c of d.composition) drugIngredients.set(c.id, { id: c.id, name: c.name, rxcui: c.rxcui });
  const classMap = new Map<string, string[]>();
  for (const d of allo.drugs) for (const t of d.classTags) classMap.set(t, [...(classMap.get(t) ?? []), d.id]);
  const drugIds = new Set(allo.drugs.map((d) => d.id));
  for (const r of allo.recommendations) for (const id of r.drugIds) if (!drugIds.has(id)) dq.push(`Recommendation ${r.id} references unknown drug ${id}`);

  const diseases = allo.contexts.filter((c) => c.codes.length).map((c) => ({ id: `dis_${c.id.replace(/^ctx_/, "")}`, label: c.codes[0].display ?? c.label, codes: c.codes, contextIds: [c.id] }));

  // ---------------- Terminology mappings ----------------
  const HINDI_TOKENS = /\b(dard|bukhar|khansi|khaansi|ulti|dast|kabz|chakkar|jalan|khujli|neend|ghabrahat|saans|pet|gala|naak|zukam|sardi|badan|jodon|kamar|thakan|dama|mirgi|sar|sir|chhink|chheenk|jukam|kamzori|bhook|khoon|pasina|ghutan|behoshi)\b/;
  const terminologyMappings: TerminologyMapping[] = [];
  const tmSrc = { sourceId: "cds-curated", reference: "Curated lexicon", lastVerified: today() };
  for (const s of symptoms) for (const syn of [s.label, ...s.synonyms])
    terminologyMappings.push({ id: `tm_${slug(syn)}_${s.id}`, input: syn.toLowerCase(), conceptType: "symptom", conceptId: s.id, language: HINDI_TOKENS.test(syn.toLowerCase()) ? "hi-Latn" : "en", source: tmSrc });
  for (const d of allo.drugs) {
    for (const syn of [d.name, ...d.synonyms]) terminologyMappings.push({ id: `tm_${slug(syn)}_${d.id}`, input: syn.toLowerCase(), conceptType: "drug", conceptId: d.id, language: "en", source: d.sources[0] });
    for (const b of d.brandMappings) if (b.composition.length === 1) terminologyMappings.push({ id: `tm_brand_${slug(b.brand)}_${d.id}`, input: b.brand.toLowerCase(), conceptType: "drug", conceptId: d.id, language: "en", source: { sourceId: "cds-curated", reference: `Brand mapping (${b.country}) — ${b.verification}`, lastVerified: today() } });
  }
  for (const t of ayB.indications as MasterKnowledge["ayurvedicIndications"]) for (const v of [t.term, ...t.variants])
    for (const sid of t.symptomIds) terminologyMappings.push({ id: `tm_ay_${slug(v)}_${sid}`, input: v.toLowerCase(), conceptType: "ayurveda-term", conceptId: sid, language: "sa-Latn", source: t.source });
  const dedupTm = new Map(terminologyMappings.map((m) => [m.id, m]));

  // ---------------- Knowledge graph edges ----------------
  const E: GraphEdge[] = [];
  const add = (from: string, rel: string, to: string, sourceId: string) => E.push({ from, rel, to, sourceId });
  for (const c of allo.contexts) {
    for (const s of c.requires) add(c.id, "HAS_SYMPTOM", s, c.sources[0]?.sourceId ?? "cds-curated");
    for (const g of c.guidelineIds) add(c.id, "DESCRIBED_IN", g, c.sources[0]?.sourceId ?? "cds-curated");
  }
  for (const r of allo.recommendations) for (const d of r.drugIds) add(r.contextId, r.kind === "do-not-offer" ? "GUIDELINE_DO_NOT_OFFER" : "GUIDELINE_SUPPORT", d, r.sources[0]?.sourceId ?? "cds-curated");
  for (const d of allo.drugs) {
    for (const c of d.composition) add(d.id, "CONTAINS", c.id, "rxnorm");
    for (const t of d.classTags) add(d.id, "HAS_CLASS", `class:${t}`, "cds-curated");
    for (const a of d.seriousAdverseEffects) add(d.id, "HAS_SIDE_EFFECT", `ae:${slug(a)}`, "dailymed");
  }
  for (const x of allo.interactions) add(x.a, "INTERACTS_WITH", x.b, x.sources[0]?.sourceId ?? "cds-curated");
  for (const h of herbs) {
    for (const r of h.rasa) add(h.id, "HAS_RASA", `rasa:${r}`, "amidha-herb-db");
    for (const g of h.guna) add(h.id, "HAS_GUNA", `guna:${g}`, "amidha-herb-db");
    if (h.virya) add(h.id, "HAS_VIRYA", `virya:${h.virya}`, "amidha-herb-db");
    if (h.vipaka) add(h.id, "HAS_VIPAKA", `vipaka:${h.vipaka}`, "amidha-herb-db");
  }
  for (const f of forms) for (const hid of f.ingredientHerbIds) add(hid, "USED_IN", f.id, "bhaishajya-kalpana-kosha");
  const termIndex = new Map<string, string>();
  for (const t of ayB.indications as MasterKnowledge["ayurvedicIndications"]) for (const v of [t.term, ...t.variants]) termIndex.set(v.toLowerCase(), t.term);
  for (const f of forms) for (const it of f.indicationTerms) { const t = termIndex.get(it.toLowerCase()); if (t) add(f.id, "HAS_INDICATION", `ayterm:${t}`, "bhaishajya-kalpana-kosha"); }
  for (const t of ayB.indications as MasterKnowledge["ayurvedicIndications"]) for (const s of t.symptomIds) add(`ayterm:${t.term}`, "APPROX_CORRELATE", s, "cds-curated");
  for (const [sym, rubs] of Object.entries(ho.symptomRubrics as Record<string, string[]>)) for (const p of rubs) if (pathToId.has(p)) add(sym, "MAPS_TO_RUBRIC", `pub_${pathToId.get(p)}`, "cds-curated");
  for (const m of homeopathyMateriaMedica) { add(m.remedyId, "DESCRIBED_BY", `mm:boericke:${m.remedyId}`, "oorep-boericke"); }
  add("mm:boericke", "SOURCE", "oorep-boericke", "oorep-boericke");
  const edgeKey = new Set<string>();
  const graphEdges = E.filter((e) => { const k = `${e.from}|${e.rel}|${e.to}`; if (edgeKey.has(k)) return false; edgeKey.add(k); return true; });

  const packs = manifest.packs.map((p) => ({ id: p.id, file: p.file, license: p.license, sourceId: p.sourceId, counts: p.counts, sha256: p.sha256 }));

  const body: Omit<MasterKnowledge, "metadata"> = {
    sources: registry.map((s) => ({ id: s.id, name: s.name, level: s.level, dataLicense: s.dataLicense })),
    bodySystems, symptoms, conditions: allo.contexts, diseases,
    drugs: allo.drugs,
    drugIngredients: [...drugIngredients.values()],
    drugCompositions: allo.drugs.map((d) => ({ drugId: d.id, ingredientIds: d.composition.map((c) => c.id) })),
    drugClassLexicon: cur("drug-class-lexicon.json"),
    drugClasses: [...classMap.entries()].sort().map(([id, ids]) => ({ id: `class:${id}`, label: id, drugIds: ids })),
    drugIndications: allo.recommendations.filter((r) => r.kind !== "do-not-offer").flatMap((r) => r.drugIds.map((d) => ({ drugId: d, contextId: r.contextId, guidelineRecommendationId: r.id }))),
    contraindications: allo.drugs.flatMap((d) => d.contraindications.map((c) => ({ ...c, drugId: d.id }))),
    drugInteractions: allo.interactions,
    adverseEffects: allo.drugs.flatMap((d) => [
      ...d.commonAdverseEffects.map((effect) => ({ drugId: d.id, effect, seriousness: "common" as const })),
      ...d.seriousAdverseEffects.map((effect) => ({ drugId: d.id, effect, seriousness: "serious" as const })),
    ]),
    warnings: allo.drugs.flatMap((d) => d.warnings.map((w) => ({ ...w, drugId: d.id }))),
    clinicalGuidelines: allo.guidelines,
    guidelineRecommendations: allo.recommendations,
    clinicalStudies: allo.studies,
    allopathicKnowledge: allo.knowledge,
    ayurvedicHerbs: herbs,
    ayurvedicFormulations: forms,
    ayurvedicPrinciples: principles,
    ayurvedicIndications: ayB.indications,
    ayurvedicRules: ayB.rules,
    ayurvedicSafety: { herbSafety: ayB.herbSafety, generalSafety: ayB.generalSafety },
    ayurvedicReferences: [
      { id: "ref_bkk", title: "Bhaishajya Kalpana Kosha (CC BY 4.0)", note: "Classical references per formulation are recorded as stated in the dataset (e.g., Bhavaprakasha, Sharngadhara Samhita); not independently verified against the source texts." },
      { id: "ref_api_afi", title: "Ayurvedic Pharmacopoeia of India / Ayurvedic Formulary of India (PCIM&H)", note: "Official standards — referenced by link only; not bundled." },
    ],
    homeopathyRemedies: remedies,
    homeopathyRubrics,
    homeopathyRubricRemedyRelations,
    homeopathyMateriaMedica,
    homeopathyEvidence: ho.evidence,
    homeopathyRegulatory: ho.regulatory,
    homeopathyToxicSources: toxic,
    homeopathyRubricHints: { symptomRubrics: ho.symptomRubrics, modifierRubrics: ho.modifierRubrics },
    homeopathyCaseTaking: ho.caseTakingQuestions,
    historyConditions: allo.historyConditions,
    redFlags: rf.rules,
    redFlagChecklist: rf.checklist,
    terminologyMappings: [...dedupTm.values()],
    graphEdges,
  };
  const contentHash = sha256(JSON.stringify(body));
  const master: MasterKnowledge = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version,
      lastVerifiedAt: today(),
      jurisdiction: "India-first (international references where no verified Indian source was available)",
      purpose: "Clinical decision support for qualified clinicians — not an autonomous prescriber",
      contentHash,
      packs,
      scopeNotes: [
        "Seed clinical scope: headache (migraine-type, tension-type), dyspepsia/GORD, allergic rhinitis, acute fever, URTI; red-flag screening is broader (31 rules).",
        "Allopathy drug facts are curated paraphrases of label content, marked curated-pending-verification until verified by the openFDA/RxNav importers.",
        "Homeopathy: this file holds the curated-hint rubric subset; the full Repertorium Publicum (74,667 rubrics) and Boericke materia medica are in the packs listed above.",
        "Ayurveda herbs/formulations/principles imported from CC BY 4.0 datasets; indication bridges are approximate correlates, not NAMASTE mappings.",
        "Not bundled (licence): WHO ATC/DDD, NAMASTE codes, DrugCentral, SNOMED CT, NICE/ICMR/MoHFW guideline text, API/AFI monographs.",
      ],
    },
    ...body,
  };
  return { master, dataQuality: dq };
}

if (require.main === module) {
  const out = arg("out") ?? path.join(DATA, "master-medical-knowledge.json");
  const { master, dataQuality } = buildMaster(arg("version") ?? KB_VERSION);
  writeJson(out, master, false);
  const counts = Object.fromEntries(Object.entries(master).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length]));
  console.log(`Master knowledge v${master.metadata.version} → ${path.relative(process.cwd(), out)}`);
  console.log(`contentHash ${master.metadata.contentHash}`);
  console.table(counts);
  if (dataQuality.length) { console.log("Data-quality notes:"); for (const n of dataQuality) console.log("  - " + n); }
  const registry = readJson<{ sources: SourceRegistryEntry[] }>(path.join(DATA, "source-registry.json")).sources;
  const pub = gz<PublicumPack>("processed/homeopathy/publicum.pack.json.gz");
  const report = validateKnowledge(master, { registry, rubricPaths: new Set(pub.rubrics.map((r) => r[1])) });
  const reportOut = arg("report") ?? path.join(DATA, "validation-report.json");
  writeJson(reportOut, { ...report, dataQualityNotes: dataQuality });
  console.log(`Validation: ${report.errors.length} error(s), ${report.warnings.length} warning(s); provenance coverage ${report.provenance.coveragePercent}% → ${path.relative(process.cwd(), reportOut)}`);
  for (const e of report.errors) console.log("  ERROR " + e);
  if (report.errors.length) process.exit(1);
}
