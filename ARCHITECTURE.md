# Architecture

## Overview

```
Browser (Next.js App Router, React 19, Tailwind 4, React Hook Form + Zod)
   │  pages: dashboard, 8-step case form, analysis, cases, recommendations, medicines,
   │         repertory, Ayurveda explorer, sources, data health, settings, search
   ▼
proxy.ts  ── access control (signed session cookie; fails closed when misconfigured)
   ▼
Route handlers /api/*  ── same-origin check · Zod validation · 256 KB body limit · no-store
   ▼
lib/storage/service.ts ── the only module that combines storage + pipeline + audit
   ├── lib/engines/analyze.ts ── Deterministic analysis pipeline (below)
   ├── lib/storage/cases.ts   ── cases & analyses (JSON files, atomic writes, strict IDs)
   └── lib/storage/audit.ts   ── append-only, SHA-256 hash-chained audit log
   ▼
lib/knowledge/store.ts ── loads data/master-medical-knowledge.json and the homeopathy packs once per process
lib/knowledge/indexes.ts ── maps, lexicons (symptom / drug / condition) keyed by content hash
```

## Analysis pipeline (lib/engines/analyze.ts)

1. **Normalise** the case into a patient state (`lib/safety/patient-state.ts`): age bands, pregnancy (incl. ≥20 weeks),
   breastfeeding, renal (worst of stated impairment and eGFR), hepatic, chronic-condition tags, platelets, the India-first
   `dengue-risk` tag for fever (lifted only by the explicit clinician assertion *dengue excluded*), uncontrolled BP,
   current medicines resolved to drugs / ingredients / classes (brands and fixed-dose combinations included), allergies
   resolved to drug, ingredient and class tags.
2. **Safety / red-flag engine** (`lib/safety/red-flags.ts`) evaluates every applicable rule. Missing vitals are reported,
   never assumed normal. *Emergency* → candidate generation blocked. *Urgent* → withheld until an acknowledgement that
   covers every urgent rule is recorded.
3. **Clinical-context matching** (`lib/engines/context.ts`): weighted feature sets with met / not-met / unknown status and
   alarm features. The score is a transparency measure of fit, not a probability.
4. **Follow-up questions** (`lib/engines/followup.ts`): safety gaps first, then diagnostic features, characterisation,
   repertory modalities and Ayurvedic assessment. Maximum 14.
5. **System engines**, each separate:
   - **Allopathy** (`allopathy.ts`): recommendations attached to qualifying contexts → per-drug safety check
     (`lib/safety/medication.ts`). Safety exclusions win across contexts. Alarm features divert to investigation.
   - **Ayurveda** (`ayurveda.ts`): classical-term bridges → indications of herbs/formulations → dosha/agni/ama rules →
     herb safety (LiverTox notes), Rasaushadhi flag, pregnancy and herb–drug review.
   - **Homeopathy** (`homeopathy.ts`, `repertory.ts`): clinician-selected rubrics (or clearly-labelled auto-suggestions
     from structured modalities) → repertorization (coverage, then weighted grade sum) → toxic-source and population
     flags → materia-medica link. Evidence position (NHMRC 2015, RACGP) shown with every result.
6. **Conflicts** (e.g. interaction evidence marked conflicting; homeopathy evidence positions) are listed, never resolved
   silently. Every analysis stores the knowledge-base version and content hash.

No step calls a language model. The optional AI mode (`lib/ai/extract.ts`) can only map free text to concept IDs that
already exist in the knowledge base; outputs are validated and the deterministic lexicon result is always returned too.

## Source hierarchy

| Level | Meaning | Examples |
|---|---|---|
| 1 | Official, regulatory and national/international clinical bodies and standards | ICMR, MoHFW STGs, NLEM, CDSCO, DailyMed/openFDA, RxNorm, NICE, WHO, ICHD-3, NCH, CCRH, CCRAS, PCIM&H, NAMASTE |
| 2 | Curated scientific databases and datasets | DrugCentral, PubChem, ChEMBL, ClinicalTrials.gov, MIMIC-IV, ARP |
| 3 | Research literature | PubMed, Cochrane |
| 4 | Structured open datasets, knowledge graphs, this project's curated layer | OOREP/Repertorium Publicum, Amidha Ayurveda datasets, PrimeKG, Synthea, `cds-curated` |
| 5 | Community / open-source projects | repertory apps, Ayurveda chatbots — architecture reference only |
| 6 | General websites | — |

Higher-level sources are preferred when they disagree; disagreements are surfaced. Community projects contributed ideas
only; no clinical content was taken from level-5/6 sources.

## Knowledge layer

Single canonical file `data/master-medical-knowledge.json` (~2.4 MB) built by
`scripts/build-knowledge-base/build-master-knowledge.ts` from `data/curated/*.json` and importer outputs in
`data/processed/`. Large reference packs (full repertory, Boericke) are gzip files referenced from the master
metadata with SHA-256 checksums. See [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md).

## Storage and the database path

The build uses local JSON files (mode 0600) under `CDS_DATA_DIR_RUNTIME` with atomic writes and an in-process write
queue — adequate for a single-clinic, single-instance deployment. `db/schema.sql` is the PostgreSQL schema for scaling
out: cases, analyses (JSONB), decisions, acknowledgements and an audit table carrying the same hash chain. Replace
`lib/storage/cases.ts` and `lib/storage/audit.ts` (the only modules touching disk) with a repository that uses it;
nothing else changes.

## Interoperability

`lib/fhir/fhir.ts` maps a case to a FHIR R4 collection Bundle (Patient with pseudonymous identifier, Encounter,
Condition, Observation with LOINC vital-sign codes, AllergyIntolerance, MedicationStatement) and maps Synthea-style
bundles back to a draft case, listing unmapped conditions rather than guessing. SNOMED CT, ICD-11 and NAMASTE codes are
placeholders until licensed code sets are loaded.
