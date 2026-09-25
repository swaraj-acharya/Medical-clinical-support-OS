# Research prompts and section information

Every clinical and reference section of the app has two tools in its toolbar:

- **About this section / About this page** — what the section shows, how it is produced, which data it uses and its
  limits. The text lives in one file, `lib/content/section-info.ts`, so the clinical-governance group can review it.
- **Research prompt** — a ready-to-copy prompt for any AI or deep-research tool (ChatGPT, Claude, Gemini, Perplexity …).
  It carries that section's data, states what the knowledge base does *not* cover, and instructs the model to research
  guidelines and research papers with verifiable citations.

The app never sends these prompts anywhere. The clinician copies or downloads them and decides where to use them.

## Where prompts appear

| Place | Prompt | Typical use |
|---|---|---|
| Analysis → safety bar | Red-flag pathway / serious causes to exclude | Emergency and urgent pathways, decision rules, safety-netting |
| Analysis → Patient summary | Medication safety review / identify unrecognised medicines | Unknown Indian brands and FDCs, regimen interactions, renal/hepatic adjustment |
| Analysis → Clinical context | Diagnosis and differential / **condition not in knowledge base** | Differential diagnosis, criteria (ICD-11, ICHD-3), work-up |
| Analysis → Follow-up | Targeted history, examination and tests | High-yield questions, likelihood ratios, scores |
| Analysis → Allopathy / Ayurveda / Homeopathy | System-specific options, **including options not in the knowledge base** | Guideline + research-paper evidence; classical vs modern evidence; materia medica vs scientific evidence |
| Analysis → Comparison | Integrative comparison and cross-system safety | Herb–drug interactions, what not to substitute |
| Analysis → Conflicts and sources | Resolve conflicting information | Appraise disagreeing sources |
| Analysis → Decision record | Appraise the documented plan | Guideline concordance, omissions, monitoring |
| Case page | Full case research brief | One prompt covering everything |
| Medicine pages (drug, herb, formulation, remedy) | Verify and update / classical and modern evidence / materia medica and evidence | Checking curated facts against current labels and literature |
| Search, Medicines list, Ayurveda explorer | **Term not in the knowledge base** | Any condition, medicine, brand, herb or remedy the tool does not hold |
| New case → symptom picker | Symptom not in the list | Unlisted symptoms or colloquial terms |
| Repertory (after repertorizing) | Compare repertorized remedies | Materia-medica differentiation + evidence position |
| Data health | Verify pending drug facts | Label verification of curated seeds |

## What every prompt contains

1. **Role and boundaries** — research assistant to a registered clinician; the clinician decides.
2. **Urgency banner** when an emergency or urgent red flag is present (answer must start with the immediate pathway).
3. **Task and specific questions** for the section.
4. **Patient context (de-identified)** — age, sex, pregnancy/breastfeeding, organ function, conditions, allergies,
   current medicines, structured symptoms, red-flag items, vitals, labs, Ayurvedic assessment, chosen rubrics.
5. **What the tool already found** — candidates, exclusions with reasons, advisories, knowledge-base version — framed as
   "a starting point to check, not verified facts".
6. **Gaps** — what the knowledge base does not cover (unmatched condition, unrecognised medicine, no options left after
   safety filtering, limited datasets). These are the main reasons for the research.
7. **How to research** — by depth (below), source priority list (India-first by default), ready-to-run PubMed queries
   with publication-type and date filters, and keywords.
8. **Rules** — cite every claim with PMID/DOI/URL; never invent references (write "unverified"); say if the model cannot
   browse; label evidence type and GRADE certainty; no doses unless quoted from a cited label/guideline; check every option
   against the patient's factors; flag red flags; keep traditional/classical rationale separate from modern evidence.
9. **Answer format** — fixed headings, tables where helpful, numbered Vancouver-style references with identifiers.

### Options in the prompt panel

| Option | Effect |
|---|---|
| Depth: Quick answer | Concise answer from the top guideline and most recent systematic review (3–6 references) |
| Depth: Thorough, with research papers (default) | Guidelines → systematic reviews/RCTs → regulatory/safety sources, with PubMed searches |
| Depth: Structured evidence review | PICO, multi-database search with reported strings and counts, evidence table, GRADE, ongoing trials (CTRI, ClinicalTrials.gov) |
| Include de-identified case data | On by default |
| Include what this tool found | On by default |
| Include clinician's free-text notes | **Off by default**; identifiers are scrubbed if switched on |
| Guidance focus | India first (ICMR, MoHFW, NLEM, CDSCO, PvPI, NFI) or international |

The text is editable before copying; "Discard edits" restores the generated version.

## Privacy

- The patient reference is never included.
- Free text (complaint description, Ayurvedic notes, case notes, decision reasons) is excluded unless the clinician opts
  in; when included it passes through `scrubIdentifiers()` (emails, phone/ID numbers, Aadhaar-like numbers, titled names,
  hospital record numbers).
- Structured data can still be identifying in rare cases (e.g., unusual age + condition combinations). The panel reminds
  the clinician to review the prompt and follow the organisation's data-protection policy (DPDP Act 2023) before pasting
  it into an external service.

## Safety

AI output obtained with these prompts is **not** fed back into the app and is **not** verified by it. The prompts are
designed to make verification easy (identifiers for every claim, evidence labels, uncertainty section), but the clinician
must check references before relying on them. See MEDICAL_SAFETY.md.

## Code

- `lib/prompts/build.ts` — pure builder: `buildPrompt(spec, options)`, `pubmedQuery()`, source lists, depth methods.
- `lib/prompts/specs.ts` — pure spec builders: `analysisSpecs()` (10 analysis sections), `caseSpec`, `drugSpec`,
  `herbSpec`, `formulationSpec`, `remedySpec`, `termSpec`, `repertorySpec`, `verificationSpec`, `caseSnapshot`.
- `components/section-tools.tsx` — toolbar, info panel and prompt panel (copy, download, edit, options).
- `lib/content/section-info.ts` — all "About" texts.
- Tests: `tests/unit/prompts.test.ts` (citation rules, depth options, de-identification on every demo case, unrecognised
  medicines as gaps, "condition not in knowledge base" switch, free-text opt-in and scrubbing).

To add a prompt to a new section: build a `PromptSpec` from the data the section holds (server side) and pass it to
`<Section prompt={…}>`, `<PageHeader prompt={…}>`, `<BlockHeader prompt={…}>` or `<SectionTools prompt={…}>`.
