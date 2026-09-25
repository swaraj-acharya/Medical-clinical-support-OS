# Development

## Layout

```
app/                 pages (App Router) and API route handlers (app/api/**/route.ts)
components/          UI: case form, repertory selector, analysis blocks, decision controls, shared UI
lib/
  knowledge/         store (load master + packs), indexes (lexicons), validate
  normalize/         text normalisation, lexicon (exact/synonym/normalised/fuzzy), medication & allergy resolution
  safety/            patient-state tags, red-flag engine, medication safety, regimen review
  engines/           context matching, allopathy, ayurveda, repertory, homeopathy, follow-up, analyze (pipeline)
  storage/           runtime dir, cases/analyses, hash-chained audit log, service layer
  auth/ security/    session tokens, request hardening, log redaction
  ai/                deterministic + optional AI concept extraction
  prompts/           research-prompt builder and per-section prompt specs (pure, client-safe)
  content/           "About this section" texts
  fhir/ search/      FHIR mapping, global search
  demo/              fictional demo cases and seeding
  validation/        Zod schemas (case, decision, acknowledgement)
types/               knowledge, provenance, recommendation, pack types
scripts/             knowledge build/validate/update, importers, docs generation, demo seeding
data/                curated inputs, processed imports, master knowledge, registry (see data/README.md)
tests/               unit/, integration/, security/, fixtures/
db/schema.sql        PostgreSQL schema for scaling beyond file storage
```

## Conventions

- Engines are pure functions of (case, patient state, knowledge index) — no I/O — so they are easy to test.
- Only `lib/storage/*` touches the runtime directory; only `lib/knowledge/store.ts` reads knowledge files.
- New clinical facts need `sources[]` + `verification`; the validator enforces it.
- UI language: “candidate”, “suggested for clinician review”, “no conflict in entered data”. Never “safe”, “cure”,
  “best treatment” or probabilities.

## Testing

```bash
npm test               # all tests (Vitest); runtime data goes to data/runtime-test/
npx vitest run tests/unit/safety.test.ts
npm run check          # validate knowledge + typecheck + tests
```

Unit tests cover normalisation, lexicons, medication/allergy resolution, red-flag rules, medication safety, context
matching, each engine, repertorization and the knowledge validator. Integration tests run every demo case through the
pipeline, the storage/decision/acknowledgement flow and audit-chain tamper detection. Security tests cover schema
rejection, path traversal, session tokens, fail-closed auth, CSRF checks, log redaction and identifier scrubbing.

## Adding a clinical context (allopathy)

1. Add symptoms (with synonyms) to `data/curated/symptoms.json` if needed.
2. Add the guideline, context (features, `minimumFeatures`, alarm features) and recommendations to
   `data/curated/allopathy.json`; add drugs with contraindications/warnings using known patient tags.
3. Add red-flag rules for the presentation in `data/curated/red-flags.json`.
4. `npm run knowledge:update`, review, promote; add tests.

## Adding an importer

Write `scripts/import/import-<name>.ts` that reads a local copy (or downloads to `data/imports/`), writes normalised
records with provenance to `data/processed/<system>/`, and a manifest with input hashes, counts and licence. Merge it in
`build-master-knowledge.ts`, register the source, regenerate `DATA_SOURCES.md`.
