# Clinical Decision Support Platform — Allopathy · Ayurveda · Homeopathy

A doctor-facing, source-grounded clinical decision-support and reference application. It helps a qualified clinician
record a case, screens it for red flags **first**, and then — in three separate engines that share one case model —
surfaces *candidates for clinician review* from allopathic guidelines, classical Ayurvedic knowledge and a homeopathic
repertory. Every candidate shows why it was surfaced, its safety findings, its evidence label and its sources.

> **This is decision support, not a prescriber.** It does not diagnose, does not choose treatment, does not give doses
> and must not be used for real patients until the clinical-governance steps in [MEDICAL_SAFETY.md](MEDICAL_SAFETY.md)
> are complete. Many allopathic drug facts are hand-curated seeds marked *pending verification*.

## What it does

| Area | What you get |
|---|---|
| Case entry | 8-step form (patient, safety background, medicines, complaint, associated symptoms & red-flag checklist, vitals & labs, system-specific assessment, review). Symptom search understands English, romanised Hindi (e.g. *sar dard*, *bukhar*) and Ayurvedic terms; brands such as *Combiflam* resolve to their ingredients. |
| Safety first | 31 red-flag rules (thunderclap headache, meningism, sepsis/qSOFA, NEWS2-style vitals, anaphylaxis, pregnancy, paediatric danger signs, dengue warning signs …). **Emergency** blocks all candidates; **urgent** withholds them until a clinician records an assessment (audit-logged). |
| Medication safety | Allergy (drug, ingredient, class), age, pregnancy/breastfeeding, renal (incl. eGFR), hepatic, drug–drug (drug and class level), drug–disease, duplicate therapy (incl. inside fixed-dose combinations), plus a review of the *current* regimen. |
| Allopathy | Clinical-context matching (ICHD-3-style feature sets) → guideline recommendations → safety filter. Metric: *guideline / clinical context match*. |
| Ayurveda | Symptom → classical-term bridges (approximate, not NAMASTE) → classical indications of 360 herbs and 175 formulations; dosha / agni / ama assessment marks items as supporting or needing review. Traditional rationale and modern evidence are shown separately; Rasaushadhi (mineral/metal) preparations are always flagged. |
| Homeopathy | Real repertory workflow on the full Repertorium Publicum (74,667 rubrics, 2,432 remedies): chapter → rubric → sub-rubric, weights, repertorization grid, Boericke materia medica. Metric: *repertory match* — never a probability. The NHMRC evidence position is shown next to every result. |
| Reference | Medicine pages (“What does this medicine do?”), Ayurveda explorer, repertory, global search, source & licence registry (76 sources), data-health page. |
| Research prompts | Every section has a **Research prompt** that carries the section's de-identified data and what the knowledge base lacks (condition not covered, medicine or brand not recognised, options excluded) and tells any AI or deep-research tool to research guidelines and research papers with verifiable citations. Depth: quick / thorough / structured evidence review. See [RESEARCH_PROMPTS.md](RESEARCH_PROMPTS.md). |
| Section info | Every page and section has an **About** panel: what it shows, how it works, data used, limits. |
| Governance | Doctor decisions (review/accept/modify/reject/alternative) and a hash-chained audit log that records inputs, knowledge-base version, candidates, exclusions and sources. |

## Quick start

```bash
npm ci                      # Node ≥ 20.9 (tested on Node 22)
npm run knowledge:validate  # the knowledge base ships pre-built; validates it (0 errors expected)
npm run dev                 # http://localhost:3000 — access control is OFF in development
```

Open the dashboard and choose **Load demo cases** (seven fictional cases) or **Start a new case**.

Production build:

```bash
npm run build
CDS_ACCESS_TOKEN=... CDS_SESSION_SECRET=... npm start
# local synthetic-data demo only:  CDS_ALLOW_UNAUTHENTICATED=true npm start
```

In production the app **refuses all requests** unless access control is configured (see [SECURITY.md](SECURITY.md)).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development server / production build / production server |
| `npm run typecheck` | TypeScript, no emit (app, scripts and tests) |
| `npm test` | Vitest: unit, integration and security tests (91) |
| `npm run check` | validate knowledge + typecheck + tests |
| `npm run knowledge:build` | Rebuild `data/master-medical-knowledge.json` from curated + processed inputs and write the validation report |
| `npm run knowledge:validate` | Validate the master file (IDs, references, provenance, stale sources, pack checksums) |
| `npm run knowledge:update` | Safe update: optional re-import → staged build → validate → diff → `--promote` with backup. Never overwrites silently. |
| `npm run import:oorep` / `import:ayurveda` | Re-run the bundled-data importers (download if raw files are absent) |
| `npm run import:openfda` / `import:rxnav` | Network verifiers for curated drug facts (openFDA label metadata, RxNav RXCUI status) |
| `npm run import:user -- --atc file.csv` | Import user-licensed WHO ATC codes (or `--namaste file.csv`) |
| `npm run import:synthea -- --file bundle.json [--create]` | Convert a synthetic FHIR bundle into a draft case |
| `npm run seed:demo` | Create and analyse the fictional demo cases |
| `npm run docs:sources` | Regenerate `DATA_SOURCES.md` from the source registry |

## Environment variables

See [.env.example](.env.example). Key ones: `CDS_ACCESS_TOKEN`, `CDS_SESSION_SECRET`, `CDS_ALLOW_UNAUTHENTICATED`,
`CDS_DATA_DIR_RUNTIME`, `CDS_AI_MODE` (`off` | `extract`), `ANTHROPIC_API_KEY`, `CDS_AI_ALLOW_CLINICAL_TEXT`,
`CDS_DISABLE_DEMO`, `OPENFDA_API_KEY`.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline, engines, source hierarchy, storage, database path
- [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md) — schema, build/validate/update workflow, versioning, provenance
- [DATA_SOURCES.md](DATA_SOURCES.md) — every source, level, licence and how it is used (generated)
- [DATA_LICENSES.md](DATA_LICENSES.md) — licence obligations for bundled data (GPL-3.0, CC BY 4.0, NLM)
- [MEDICAL_SAFETY.md](MEDICAL_SAFETY.md) — intended use, limits, clinical-governance checklist
- [RESEARCH_PROMPTS.md](RESEARCH_PROMPTS.md) — research prompts and section info: where they appear, what they contain, privacy
- [SECURITY.md](SECURITY.md) — access control, privacy, audit, threat model
- [DEVELOPMENT.md](DEVELOPMENT.md) — code layout, adding knowledge, testing
- [data/README.md](data/README.md) — what each data folder contains
# Medical-clinical-support-OS
