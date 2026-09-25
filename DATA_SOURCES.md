# Data sources

Generated from `data/source-registry.json` by `npm run docs:sources`. 76 sources. The registry is the single source of truth; this file is a readable view.

**Authority levels** (lower = more authoritative): 1 official, regulatory and national/international clinical bodies and standards; 2 curated scientific databases and datasets; 3 research literature; 4 structured open datasets, knowledge graphs and this project's curated layer; 5 community / open-source projects (architecture reference or validated before use); 6 general websites.

**How used:** *Imported and bundled* — data is in this repository; *API adapter* — importer script that runs on a networked machine; *User-supplied file* — licence prevents redistribution, the user imports their own copy; *Reference link / Metadata only* — cited, no content copied; *Design reference* — informed architecture only.

## Shared / safety / interoperability

| Source | Level | Data licence | Commercial use | How used | Data copied | Status | Checked |
|---|---|---|---|---|---|---|---|
| [HL7 FHIR R4/R5](https://hl7.org/fhir/) `fhir` | 1 | CC0 (specification) | permitted | Design reference | no | active | 2026-09-25 |
| [LiverTox (NIDDK/NLM)](https://www.ncbi.nlm.nih.gov/books/NBK547852/) `livertox` | 1 | Public (US Government) | permitted | Reference link | no | active | 2026-09-25 |
| [NHS Scotland National Headache Pathway](https://www.rightdecisions.scot.nhs.uk/borders-ref-help-toolkit/headache/1-national-headache-pathway/) `nhs-scotland-headache` | 1 | © NHS Scotland | restricted | Reference link | no | active | 2026-09-25 |
| [RCEM Learning](https://www.rcemlearning.co.uk/) `rcem-learning` | 1 | © RCEM | restricted | Reference link | no | active | 2026-09-25 |
| [Resuscitation Council UK — Emergency treatment of anaphylaxis (2021)](https://www.resus.org.uk/library/additional-guidance/guidance-anaphylaxis/emergency-treatment) `rcuk-anaphylaxis` | 1 | © RCUK | restricted | Reference link | no | active | 2026-09-25 |
| [Royal College of Physicians — NEWS2](https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/) `rcp-news2` | 1 | © RCP | restricted | Reference link | no | active | 2026-09-25 |
| [Sepsis-3 / qSOFA (Singer et al., JAMA 2016)](https://jamanetwork.com/journals/jama/fullarticle/2492881) `sepsis-3` | 1 | Journal copyright | restricted | Reference link | no | active | 2026-09-25 |
| [SNOMED CT](https://www.snomed.org/) `snomed-ct` | 1 | Affiliate licence (India is a member country via NRCeS) | restricted | Metadata only | no | active | 2026-09-25 |
| [Tele-MANAS (MoHFW) mental health helpline 14416](https://telemanas.mohfw.gov.in/) `tele-manas` | 1 | Government of India | unclear | Reference link | no | active | 2026-09-25 |
| [US Food and Drug Administration](https://www.fda.gov/) `fda` | 1 | Public (US Government) | permitted | Reference link | no | active | 2026-09-25 |
| [WHO Emergency Triage Assessment and Treatment (ETAT)](https://www.who.int/publications/i/item/9241546875) `who-etat` | 1 | © WHO (CC BY-NC-SA IGO for newer items) | restricted | Reference link | no | active | 2026-09-25 |
| [WHO ICD-10 / ICD-11](https://icd.who.int/) `icd` | 1 | ICD-11 CC BY-ND 3.0 IGO; ICD-10 © WHO | restricted | Subset bundled | yes | active | 2026-09-25 |
| [WHO Integrated Management of Childhood Illness (IMCI)](https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/integrated-management-of-childhood-illness) `who-imci` | 1 | © WHO | restricted | Reference link | no | active | 2026-09-25 |
| [WHO/TDR Dengue guidelines for diagnosis, treatment, prevention and control (2009)](https://www.who.int/publications/i/item/9789241547871) `who-dengue-2009` | 1 | © WHO | restricted | Reference link | no | active | 2026-09-25 |
| [ClinicalTrials.gov](https://clinicaltrials.gov/) `clinicaltrials` | 2 | Public (US Government) | permitted | Reference link | no | active | 2026-09-25 |
| [MIMIC-IV / MIMIC-IV-Note (PhysioNet)](https://physionet.org/) `mimic-iv` | 2 | PhysioNet Credentialed Health Data Licence (training + DUA required) | restricted | Metadata only | no | active | 2026-09-25 |
| [Cochrane Library](https://www.cochranelibrary.com/) `cochrane` | 3 | Publisher copyright | restricted | Reference link | no | active | 2026-09-25 |
| [PubMed](https://pubmed.ncbi.nlm.nih.gov/) `pubmed` | 3 | Citations public; article text per publisher | permitted | Reference link | no | active | 2026-09-25 |
| [CDS curated clinical layer](./KNOWLEDGE_BASE.md) `cds-curated` | 4 | Project content | permitted | Imported and bundled | yes | active | 2026-09-25 |
| [Synthea synthetic patients](https://github.com/synthetichealth/synthea) `synthea` | 4 | Synthetic (no real patients) | permitted | User-supplied file | no | active | 2026-09-25 |

## Allopathy

| Source | Level | Data licence | Commercial use | How used | Data copied | Status | Checked |
|---|---|---|---|---|---|---|---|
| [ARIA guidelines (allergic rhinitis)](https://www.jacionline.org/) `aria` | 1 | Journal copyright | restricted | Reference link | no | active | 2026-09-25 |
| [Central Drugs Standard Control Organisation (CDSCO)](https://cdsco.gov.in/) `cdsco` | 1 | Government of India publication | unclear | Reference link | no | active | 2026-09-25 |
| [DailyMed (NLM) — Structured Product Labeling](https://dailymed.nlm.nih.gov/) `dailymed` | 1 | US Government work (labels are public) | permitted | Reference link | no | active | 2026-09-25 |
| [European Medicines Agency (EMA)](https://www.ema.europa.eu/) `ema` | 1 | EMA content reusable with acknowledgement (per EMA legal notice) | permitted | Reference link | no | active | 2026-09-25 |
| [FDA Drug Safety Communications](https://www.fda.gov/drugs/drug-safety-and-availability/drug-safety-communications) `fda-dsc` | 1 | Public (US Government) | permitted | Reference link | no | active | 2026-09-25 |
| [ICHD-3 (International Headache Society)](https://ichd-3.org) `ichd-3` | 1 | © IHS (Cephalalgia) | restricted | Reference link | no | active | 2026-09-25 |
| [ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes](https://www.icmr.gov.in/guidelines) `icmr-amu` | 1 | © ICMR — all rights reserved | restricted | Reference link | no | active | 2026-09-25 |
| [MoHFW / Clinical Establishments Standard Treatment Guidelines](https://clinicalestablishments.mohfw.gov.in/en/standard-treatment-guidelines) `mohfw-stg` | 1 | Government of India publication (reuse terms not stated) | unclear | Reference link | no | active | 2026-09-25 |
| [National List of Essential Medicines (India) 2022](https://cdsco.gov.in/) `nlem` | 1 | Government of India publication | unclear | Metadata only | no | active | 2026-09-25 |
| [NICE guidance](https://www.nice.org.uk/guidance) `nice` | 1 | © NICE — reuse requires permission; UK-specific | restricted | Reference link | no | active | 2026-09-25 |
| [openFDA drug APIs](https://open.fda.gov/apis/drug/) `openfda` | 1 | Public domain (CC0) with openFDA terms; not for clinical decision-making without validation | permitted | API adapter | no | active | 2026-09-25 |
| [Pharmacovigilance Programme of India (PvPI)](https://www.ipc.gov.in/PvPI/about.html) `pvpi` | 1 | Government of India | unclear | Reference link | no | active | 2026-09-25 |
| [RxNorm (NLM)](https://www.nlm.nih.gov/research/umls/rxnorm/index.html) `rxnorm` | 1 | Full release requires UMLS licence; Current Prescribable Content and RxNav APIs available without licence | permitted | API adapter | no | active | 2026-09-25 |
| [UK Medicines and Healthcare products Regulatory Agency (MHRA)](https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency) `mhra` | 1 | Open Government Licence v3.0 (most GOV.UK content) | permitted | Reference link | no | active | 2026-09-25 |
| [WHO ATC/DDD Index (WHOCC)](https://atcddd.fhi.no/) `who-atc` | 1 | © WHOCC; index sold; no commercial use without permission | prohibited | User-supplied file | no | active | 2026-09-25 |
| [WHO Model List of Essential Medicines](https://www.who.int/publications/i/item/B09474) `who-eml` | 1 | CC BY-NC-SA 3.0 IGO (WHO publications) | restricted | Reference link | no | active | 2026-09-25 |
| [ChEMBL](https://www.ebi.ac.uk/chembl/) `chembl` | 2 | CC BY-SA 3.0 | permitted | User-supplied file | no | active | 2026-09-25 |
| [DrugCentral](https://drugcentral.org/download) `drugcentral` | 2 | CC BY-SA 4.0 | permitted | User-supplied file | no | stale | 2026-09-25 |
| [PubChem](https://pubchem.ncbi.nlm.nih.gov/) `pubchem` | 2 | Public domain (NCBI) with per-source exceptions | permitted | API adapter | no | active | 2026-09-25 |
| [Hetionet](https://github.com/hetio/hetionet) `hetionet` | 4 | Mixed (per-source; some non-commercial) | unclear | Design reference | no | stale | 2026-09-25 |
| [iBKH (integrative Biomedical Knowledge Hub)](https://github.com/wcm-wanglab/iBKH) `ibkh` | 4 | Mixed / unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [OptimusKG](https://github.com/mims-harvard/OptimusKG) `optimuskg` | 4 | Mixed (per upstream source) | unclear | Design reference | no | active | 2026-09-25 |
| [PrimeKG](https://github.com/mims-harvard/PrimeKG) `primekg` | 4 | Mixed (inherits licences of 20 upstream sources) | unclear | Design reference | no | active | 2026-09-25 |
| [Therapeutics Data Commons](https://github.com/mims-harvard/TDC) `tdc` | 4 | Per dataset | unclear | Design reference | no | active | 2026-09-25 |

## Ayurveda

| Source | Level | Data licence | Commercial use | How used | Data copied | Status | Checked |
|---|---|---|---|---|---|---|---|
| [CCRAS](https://ccras.nic.in/) `ccras` | 1 | Government of India | unclear | Reference link | no | active | 2026-09-25 |
| [NAMASTE (National AYUSH Morbidity & Standardized Terminologies Electronic)](https://namaste.ayush.gov.in/) `namaste` | 1 | Ministry of AYUSH (download terms not verified) | unclear | User-supplied file | no | active | 2026-09-25 |
| [PCIM&H — Ayurvedic Pharmacopoeia of India (API) / Ayurvedic Formulary of India (AFI)](https://www.portal.pcimh.gov.in/) `pcimh` | 1 | Government of India (copyright; sold publications) | restricted | Reference link | no | active | 2026-09-25 |
| [AYUSH Research Portal](https://arp.ayush.gov.in/) `arp` | 2 | Government of India | unclear | Reference link | no | active | 2026-09-25 |
| [e-Charak](https://echarak.ayush.gov.in/knowledge_resources) `echarak` | 2 | Terms restrict commercial use (not verified for reuse) | restricted | Reference link | no | active | 2026-09-25 |
| [Amidha Ayurveda Herb Database](https://github.com/sciencewithsaucee-sudo/herb-database) `amidha-herb-db` | 4 | CC BY 4.0 (v2.0.0, DOI 10.5281/zenodo.17475351) | permitted | Imported and bundled | yes | active | 2026-09-25 |
| [Bhaishajya Kalpana Kosha](https://github.com/sciencewithsaucee-sudo/Bhaishajya-Kalpana-Kosha) `bhaishajya-kalpana-kosha` | 4 | CC BY 4.0 (v1.0.0, DOI 10.5281/zenodo.18243950) | permitted | Imported and bundled | yes | active | 2026-09-25 |
| [Siddhanta Kosha](https://github.com/sciencewithsaucee-sudo/Siddhanta-Kosha) `siddhanta-kosha` | 4 | CC BY 4.0 (DOI 10.5281/zenodo.17481343) | permitted | Imported and bundled | yes | active | 2026-09-25 |
| [AI-Driven-Ayuvervedic-Advisor](https://github.com/anubhav811/AI-Driven-Ayuvervedic-Advisor) `ai-ayurvedic-advisor` | 5 | Unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [AYUCARE](https://github.com/AbdullahShiraz/AYUCARE) `ayucare` | 5 | Unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [AyurProject](https://github.com/anupamkr1708/AyurProject) `ayurproject` | 5 | Unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [AyurvedaCare_AI](https://github.com/Kalyx1111/AyurvedaCare_AI) `ayurvedacare-ai` | 5 | Unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [Ayurvedam-Data](https://github.com/AdityaVardhan-B/Ayurvedam-Data) `ayurvedam-data` | 5 | Unclear | unclear | Metadata only | no | unverified | 2026-09-25 |
| [Ayurvedic Herb Explorer](https://github.com/sciencewithsaucee-sudo/ayurvedic-herb-explorer) `ayurvedic-herb-explorer` | 5 | Uses Amidha herb data | permitted | Design reference | no | active | 2026-09-25 |
| [Charak_Samhita (RAG)](https://github.com/mananjp/Charak_Samhita) `charak-samhita-rag` | 5 | Unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [VedAssist2](https://github.com/vijay-varadarajan/VedAssist2) `vedassist2` | 5 | Unclear | unclear | Design reference | no | unverified | 2026-09-25 |

## Homeopathy

| Source | Level | Data licence | Commercial use | How used | Data copied | Status | Checked |
|---|---|---|---|---|---|---|---|
| [CCRH Standard Treatment Guidelines in Homoeopathy](https://ccrhindia.ayush.gov.in/publications/STG) `ccrh-stg` | 1 | Government of India | unclear | Reference link | no | active | 2026-09-25 |
| [Central Council for Research in Homoeopathy (CCRH)](https://ccrhindia.ayush.gov.in/) `ccrh` | 1 | Government of India (reuse terms not stated) | unclear | Reference link | no | active | 2026-09-25 |
| [National Commission for Homoeopathy](https://www.nch.org.in/nch-gazetted-rules-and-regulations) `nch` | 1 | Government of India | unclear | Reference link | no | active | 2026-09-25 |
| [NHMRC (Australia) — homeopathy evidence review 2015](https://www.nhmrc.gov.au/sites/default/files/images/nhmrc-information-paper-effectiveness-of-homeopathy.pdf) `nhmrc` | 1 | © Commonwealth of Australia (check the licence statement in the document) | unclear | Reference link | no | active | 2026-09-25 |
| [NLM Digital Collections](https://collections.nlm.nih.gov/) `nlm-collections` | 1 | Per item (many public domain) | permitted | Reference link | no | active | 2026-09-25 |
| [RACGP position statement on homeopathy](https://www.racgp.org.au/) `racgp` | 1 | © RACGP | restricted | Reference link | no | active | 2026-09-25 |
| [Boericke — Pocket Manual of Homoeopathic Materia Medica (1906) via OOREP](https://github.com/nondeterministic/oorep) `oorep-boericke` | 4 | Public-domain text; transcription in GPL-3.0 repository | permitted | Imported and bundled | yes | active | 2026-09-25 |
| [OOREP — Repertorium Publicum](https://github.com/nondeterministic/oorep) `oorep` | 4 | GPL v3 (declared in dump info table for publicum) | permitted | Imported and bundled | yes | active | 2026-09-25 |
| [kent_repertory_etl](https://github.com/aadjones/kent_repertory_etl) `kent-repertory-etl` | 5 | Scraped HTML (285 files) of third-party site | unclear | Design reference | no | active | 2026-09-25 |
| [myhomeo](https://github.com/mannasoumya/myhomeo) `myhomeo` | 5 | Scraped third-party transcription | unclear | Design reference | no | unverified | 2026-09-25 |
| [oorep-local-repertory](https://github.com/drwjkirkpatrick-web/oorep-local-repertory) `oorep-local-repertory` | 5 | Derived from OOREP; expanded corpus provenance unclear | unclear | Design reference | no | unverified | 2026-09-25 |
| [oorep-mcp](https://github.com/Dhi13man/oorep-mcp) `oorep-mcp` | 5 | No data (queries oorep.com) | permitted | Design reference | no | active | 2026-09-25 |
| [OpenHomeopath](https://github.com/henri-hulski/OpenHomeopath) `openhomeopath` | 5 | Unclear | unclear | Design reference | no | stale | 2026-09-25 |
| [OpenRep-Deutsch](https://github.com/nondeterministic/OpenRep-Deutsch) `openrep-deutsch` | 5 | GPL-3.0 | permitted | Design reference | no | stale | 2026-09-25 |
| [Homeoint / Médi-T](https://www.homeoint.org/medi-t/index.htm) `homeoint` | 6 | Site copyright on transcriptions | unclear | Reference link | no | active | 2026-09-25 |
| [hydrogen2oxygen/repertory](https://github.com/hydrogen2oxygen/repertory) `hydrogen2oxygen-repertory` | 6 | No data | not-applicable | Metadata only | no | stale | 2026-09-25 |

## Notes per source

### AI-Driven-Ayuvervedic-Advisor (`ai-ayurvedic-advisor`)

Ayurveda AI/case-taking/RAG implementation.

- Recommended use: Case-taking/RAG pattern reference only.
- Fields used: none
- Redistribution: unclear
- Update frequency: Irregular
- Notes: Recommendations are not clinically validated; no data or model outputs used.

### Amidha Ayurveda Herb Database (`amidha-herb-db`)

Herb records: botanical name, family, synonyms, part used, indications, rasa/guna/virya/vipaka/prabhava, dosha karma.

- Recommended use: Herb properties (traditional).
- Fields used: name, botanicalName, family, englishName, sanskritSynonyms, partUsed, mainIndications, pacifies, aggravates, rasa, guna, virya, vipaka, prabhava
- Redistribution: permitted-with-conditions; attribution required — “Varshney S. (Amidha Ayurveda), Herb Database v2.0.0, DOI 10.5281/zenodo.17475351, CC BY 4.0.”
- Update frequency: Last release 2026-06-07
- Notes: Promotional 'preview' prose and images excluded.

### ARIA guidelines (allergic rhinitis) (`aria`)

Allergic Rhinitis and its Impact on Asthma guideline revision (2016).

- Recommended use: Reference for allergic rhinitis context.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic

### AYUSH Research Portal (`arp`)

AYUSH clinical/pharmacological research metadata.

- Recommended use: Modern-evidence lookups (link).
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Continuous

### AYUCARE (`ayucare`)

Ayurveda AI/case-taking/RAG implementation.

- Recommended use: Case-taking/RAG pattern reference only.
- Fields used: none
- Redistribution: unclear
- Update frequency: Irregular
- Notes: Recommendations are not clinically validated; no data or model outputs used.

### AyurProject (`ayurproject`)

Ayurveda AI/case-taking/RAG implementation.

- Recommended use: Case-taking/RAG pattern reference only.
- Fields used: none
- Redistribution: unclear
- Update frequency: Irregular
- Notes: Recommendations are not clinically validated; no data or model outputs used.

### AyurvedaCare_AI (`ayurvedacare-ai`)

Ayurveda AI/case-taking/RAG implementation.

- Recommended use: Case-taking/RAG pattern reference only.
- Fields used: none
- Redistribution: unclear
- Update frequency: Irregular
- Notes: Recommendations are not clinically validated; no data or model outputs used.

### Ayurvedam-Data (`ayurvedam-data`)

Symptom-to-medicine mappings with precautions.

- Recommended use: Low-confidence experimental reference; not used for candidates.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Irregular
- Notes: No licence; provenance of mappings unknown.

### Ayurvedic Herb Explorer (`ayurvedic-herb-explorer`)

Search/filter UI over the herb database.

- Recommended use: Filter UX reference.
- Fields used: none
- Redistribution: permitted
- Update frequency: Irregular

### Bhaishajya Kalpana Kosha (`bhaishajya-kalpana-kosha`)

Classical formulations: ingredients, type, indications, reference, reported dose, anupana.

- Recommended use: Formulation candidates (traditional).
- Fields used: name, formulationType, category, ingredients, indications, classicalReference, sourceReportedDose, anupana
- Redistribution: permitted-with-conditions; attribution required — “Varshney S. (Amidha Ayurveda), Bhaishajya Kalpana Kosha v1.0.0, DOI 10.5281/zenodo.18243950, CC BY 4.0.”
- Update frequency: Static release
- Notes: One duplicate ID detected in source (form_krimi_mudgar_rasa) — first record kept, reported by validator. Source-reported doses are displayed as source statements, not dosing advice.

### CCRAS (`ccras`)

Clinical research, treatment protocols, safety guidance.

- Recommended use: India-first Ayurveda protocol reference.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular
- Notes: Protocol PDFs not bundled.

### Central Council for Research in Homoeopathy (CCRH) (`ccrh`)

Standard Treatment Guidelines, clinical verification, research publications.

- Recommended use: India-first homeopathy reference; STGs linked.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular
- Notes: PDFs not bundled.

### CCRH Standard Treatment Guidelines in Homoeopathy (`ccrh-stg`)

STG publications.

- Recommended use: Link from homeopathy results.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular

### CDS curated clinical layer (`cds-curated`)

Hand-authored lexicon (symptom synonyms incl. romanised Hindi), red-flag rule encodings, application safety rules and terminology bridges written for this project, each citing its upstream authority.

- Recommended use: Seed rules; every fact is marked curated-pending-verification until clinical-governance sign-off.
- Fields used: symptoms, red-flag rule logic, context features, bridges
- Redistribution: permitted
- Update frequency: Per knowledge-base release
- Notes: Not an authority in itself. Requires review by a clinical safety officer before clinical use.

### Central Drugs Standard Control Organisation (CDSCO) (`cdsco`)

Indian drug regulator: approvals, banned FDC lists, safety alerts.

- Recommended use: Reference for Indian approval status and banned fixed-dose combinations.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Continuous
- Notes: Not imported.

### Charak_Samhita (RAG) (`charak-samhita-rag`)

Ayurveda AI/case-taking/RAG implementation.

- Recommended use: Case-taking/RAG pattern reference only.
- Fields used: none
- Redistribution: unclear
- Update frequency: Irregular
- Notes: Recommendations are not clinically validated; no data or model outputs used.

### ChEMBL (`chembl`)

Targets, mechanisms of action, bioactivity.

- Recommended use: Future mechanism-of-action enrichment.
- Fields used: none
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: ~2 releases/year
- Notes: Not imported (share-alike).

### ClinicalTrials.gov (`clinicaltrials`)

Registered clinical studies (API v2).

- Recommended use: Future evidence layer.
- Fields used: none
- Redistribution: permitted
- Update frequency: Daily
- Notes: Not imported.

### Cochrane Library (`cochrane`)

Systematic reviews.

- Recommended use: Citation links.
- Fields used: citation
- Redistribution: not-permitted; attribution required
- Update frequency: Continuous

### DailyMed (NLM) — Structured Product Labeling (`dailymed`)

FDA-submitted product labels: indications, contraindications, warnings, boxed warnings, interactions, adverse reactions.

- Recommended use: Label source for contraindications/warnings; link each drug to DailyMed search.
- Fields used: label section facts (curated paraphrase)
- Redistribution: permitted
- Update frequency: Daily
- Notes: Seed facts paraphrased from labels; openFDA label importer verifies sections when network is available.

### DrugCentral (`drugcentral`)

Drug indications, contraindications, targets, pharmacologic actions, identifiers.

- Recommended use: Enrichment of indications/targets via user-run import (share-alike obligations apply to derived data).
- Fields used: none
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: Irregular (latest dump 2023-11-01)
- Notes: Not bundled to keep the core dataset free of share-alike obligations; adapter documented.

### e-Charak (`echarak`)

Medicinal plant information and vernacular names.

- Recommended use: Plant name cross-check (manual).
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Continuous
- Notes: Not copied.

### European Medicines Agency (EMA) (`ema`)

EU regulator; referral outcomes and safety restrictions (e.g., 2013 metoclopramide restrictions).

- Recommended use: Cite referral outcomes / safety restrictions.
- Fields used: none
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: Continuous
- Notes: Paraphrased only.

### US Food and Drug Administration (`fda`)

Safety communications (e.g., 2017 homeopathic belladonna teething tablets).

- Recommended use: Safety communications.
- Fields used: none
- Redistribution: permitted
- Update frequency: Continuous

### FDA Drug Safety Communications (`fda-dsc`)

FDA drug safety alerts and communications (e.g., 2006 triptan + SSRI/SNRI serotonin syndrome alert).

- Recommended use: Cite safety communications by title/date.
- Fields used: none
- Redistribution: permitted
- Update frequency: Continuous
- Notes: Content paraphrased; not copied.

### HL7 FHIR R4/R5 (`fhir`)

Resource definitions (Patient, Condition, Observation, AllergyIntolerance, MedicationStatement, Encounter).

- Recommended use: Case model mapping (lib/fhir).
- Fields used: none
- Redistribution: permitted
- Update frequency: Periodic

### Hetionet (`hetionet`)

Integrative network of compounds, diseases, genes, side effects, symptoms.

- Recommended use: Relationship-type reference.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Last update 2023
- Notes: Stale; not bundled.

### Homeoint / Médi-T (`homeoint`)

Online transcriptions of Kent, Boericke, Clarke, Allen, etc.

- Recommended use: Reading reference only.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Static
- Notes: Not copied, even where underlying texts are public domain.

### hydrogen2oxygen/repertory (`hydrogen2oxygen-repertory`)

Repository contains only README and LICENSE.

- Recommended use: None — no usable data.
- Fields used: none
- Redistribution: unclear
- Update frequency: Last commit 2020
- Notes: Empty repository.

### iBKH (integrative Biomedical Knowledge Hub) (`ibkh`)

Drug, disease, symptom, side-effect, gene relations.

- Recommended use: Reference only until licence clarified.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular
- Notes: No licence file at repository root.

### WHO ICD-10 / ICD-11 (`icd`)

Disease classification.

- Recommended use: Display codes only, each marked pending verification.
- Fields used: a few ICD-10/ICD-11 codes on curated concepts
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: Annual
- Notes: Codes are few, hand-entered, and flagged for verification.

### ICHD-3 (International Headache Society) (`ichd-3`)

International Classification of Headache Disorders, 3rd edition (2018).

- Recommended use: Feature list for migraine/tension-type contexts (features named, criteria text not reproduced).
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Rare

### ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes (`icmr-amu`)

ICMR national guidance on antimicrobial use in common infectious syndromes (2nd edition 2019; revised edition Nov 2022 found).

- Recommended use: Cite by link for antimicrobial stewardship statements; paraphrase only.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Irregular (multi-year)
- Notes: Content not copied. The URTI 'no antibiotics' rule cites this guideline by link and paraphrase.

### kent_repertory_etl (`kent-repertory-etl`)

Hierarchical→relational ETL for Kent repertory HTML.

- Recommended use: Parent/child rubric ETL pattern reference.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Last commit 2025-02-06
- Notes: Raw scraped HTML not used.

### LiverTox (NIDDK/NLM) (`livertox`)

Clinical and research information on drug- and supplement-induced liver injury.

- Recommended use: Herb hepatotoxicity notes.
- Fields used: ashwagandha hepatotoxicity note (paraphrase)
- Redistribution: permitted
- Update frequency: Continuous

### UK Medicines and Healthcare products Regulatory Agency (MHRA) (`mhra`)

UK regulator; Drug Safety Update and historical CSM advice (e.g., aspirin and Reye's syndrome under 16).

- Recommended use: Cite regulatory safety advice.
- Fields used: none
- Redistribution: permitted-with-conditions; attribution required — “Contains public sector information licensed under the Open Government Licence v3.0.”
- Update frequency: Monthly (Drug Safety Update)
- Notes: Paraphrased only.

### MIMIC-IV / MIMIC-IV-Note (PhysioNet) (`mimic-iv`)

De-identified ICU records and clinical notes.

- Recommended use: Future clinical NLP research under credentialed access only.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Versioned releases
- Notes: Never bundled.

### MoHFW / Clinical Establishments Standard Treatment Guidelines (`mohfw-stg`)

Standard treatment guidelines across specialties (cardiology, critical care, obstetrics, paediatrics, dengue, snakebite, rabies, malaria, etc.).

- Recommended use: Primary India-first guideline reference; link and paraphrase.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular
- Notes: PDF guidelines not bundled because reuse terms are not explicit. Future importer should record guideline title/version/date as metadata only.

### myhomeo (`myhomeo`)

medicines4.json (688 entries) scraped from Boericke at homeoint.

- Recommended use: JSON-structure reference only.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular
- Notes: Data scraped from homeoint; not bundled (Boericke obtained from OOREP instead).

### NAMASTE (National AYUSH Morbidity & Standardized Terminologies Electronic) (`namaste`)

Standardised Ayurveda/Siddha/Unani terminology and morbidity codes; ICD-11 TM2 linkage.

- Recommended use: Terminology normalisation via user-supplied code file.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Periodic
- Notes: NAMASTE codes are not bundled or invented; the Ayurveda bridge uses approximate correlates only.

### National Commission for Homoeopathy (`nch`)

Regulations under the NCH Act 2020 (professional conduct, education).

- Recommended use: Regulatory context.
- Fields used: regulatory statement
- Redistribution: unclear; attribution required
- Update frequency: Irregular

### NHMRC (Australia) — homeopathy evidence review 2015 (`nhmrc`)

National evidence assessment.

- Recommended use: Scientific evidence label for homeopathy.
- Fields used: conclusion (paraphrase)
- Redistribution: unclear; attribution required
- Update frequency: Static

### NHS Scotland National Headache Pathway (`nhs-scotland-headache`)

Headache red flags.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### NICE guidance (`nice`)

UK national guidelines used as international references (CG150 headache, CG184 dyspepsia, NG84 sore throat, NG51/NG143 sepsis/fever, NG232 head injury, etc.).

- Recommended use: Cited by link with paraphrased statements; used where no verified Indian guideline was available.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Continuous
- Notes: No NICE text is reproduced.

### National List of Essential Medicines (India) 2022 (`nlem`)

NLEM 2022: 384 medicines in 27 therapeutic categories (latest version found).

- Recommended use: Flag whether a candidate is on NLEM (future importer).
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: ~3–5 years
- Notes: NLEM membership not yet imported; importer stub planned. No NLEM status is displayed to avoid unverified claims.

### NLM Digital Collections (`nlm-collections`)

Scanned historical homeopathic texts; many public domain.

- Recommended use: Future public-domain materia medica source (OCR required).
- Fields used: none
- Redistribution: permitted-with-conditions
- Update frequency: Static
- Notes: Not imported in v1.

### OOREP — Repertorium Publicum (`oorep`)

Open online repertory. The SQL dump contains several repertories; only 'publicum' (Repertorium Publicum, V. Polony 2008, English) is imported.

- Recommended use: Primary repertory for rubric hierarchy and repertorization.
- Fields used: remedies (2,432), rubrics (74,667), rubric–remedy grades (735,566)
- Redistribution: permitted-with-conditions; attribution required — “Repertorium Publicum by Vladimir Polony (2008), distributed with OOREP (https://www.oorep.com) under GPL v3.”
- Update frequency: Repository active (last commit 2026-08-08)
- Notes: Kent-de and other repertories in the dump are not imported (language/licence scope). Derived pack and master subset are GPL-3.0.

### Boericke — Pocket Manual of Homoeopathic Materia Medica (1906) via OOREP (`oorep-boericke`)

Materia medica text first published 1906 (public domain); transcription distributed within the OOREP repository.

- Recommended use: Materia-medica comparison for candidate remedies.
- Fields used: 688 remedy chapters with section headings and text
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: Static
- Notes: Licence field null in dump; treated as public-domain text inside GPL repo.

### oorep-local-repertory (`oorep-local-repertory`)

Offline repertory claiming 143,408 rubrics / 1.36M links built on OOREP data.

- Recommended use: Clinical phrase→rubric mapping ideas only.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Last commit 2026-08-02
- Notes: Not bundled: provenance of the expanded corpus is not documented; README describes an XOR-stream cipher (weak security).

### oorep-mcp (`oorep-mcp`)

MCP server exposing OOREP search.

- Recommended use: Design reference for structured repertory retrieval tools.
- Fields used: none
- Redistribution: permitted
- Update frequency: Last commit 2026-09-11

### openFDA drug APIs (`openfda`)

Drug label, adverse event (FAERS), NDC, recall, Drugs@FDA, shortages endpoints.

- Recommended use: Verify/refresh label sections via scripts/import/import-openfda-labels.ts.
- Fields used: none
- Redistribution: permitted
- Update frequency: Weekly
- Notes: FAERS reports are not causal evidence. api.fda.gov is not reachable from the build sandbox.

### OpenHomeopath (`openhomeopath`)

PHP repertory app with SQL dump.

- Recommended use: Data-model reference only.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Last commit 2022-05-12
- Notes: No licence file at root; SQL not imported.

### OpenRep-Deutsch (`openrep-deutsch`)

German repertory project.

- Recommended use: Navigation/repertorization approach reference.
- Fields used: none
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: Last commit 2018
- Notes: German; not imported.

### OptimusKG (`optimuskg`)

Newer MIMS biomedical knowledge graph with provenance metadata.

- Recommended use: Graph edge vocabulary reference; future import behind per-source licence filter.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Last commit 2026-09-21
- Notes: Not bundled.

### PCIM&H — Ayurvedic Pharmacopoeia of India (API) / Ayurvedic Formulary of India (AFI) (`pcimh`)

Official monographs and formulary standards.

- Recommended use: Identity/quality standard reference.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Not copied.

### PrimeKG (`primekg`)

Precision-medicine knowledge graph integrating 20 resources.

- Recommended use: Schema reference only; OptimusKG preferred as successor.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Last commit 2026-06-30
- Notes: Upstream licences heterogeneous; not bundled.

### PubChem (`pubchem`)

Chemical identifiers, structures, synonyms.

- Recommended use: Future chemical identifier enrichment.
- Fields used: none
- Redistribution: permitted-with-conditions
- Update frequency: Continuous
- Notes: Not imported in v1.

### PubMed (`pubmed`)

Citations for peer-reviewed studies.

- Recommended use: Citation links for studies.
- Fields used: citation metadata
- Redistribution: permitted-with-conditions
- Update frequency: Daily
- Notes: Only citation metadata stored.

### Pharmacovigilance Programme of India (PvPI) (`pvpi`)

National ADR reporting programme run by the Indian Pharmacopoeia Commission.

- Recommended use: Link from adverse-effect sections for ADR reporting.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Continuous
- Notes: No bulk data API found.

### RACGP position statement on homeopathy (`racgp`)

Position informed by Natural Therapies Review 2024 (published 2025).

- Recommended use: Evidence label.
- Fields used: position (paraphrase)
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic

### RCEM Learning (`rcem-learning`)

Emergency medicine red-flag teaching.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### Royal College of Physicians — NEWS2 (`rcp-news2`)

Early warning score thresholds.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### Resuscitation Council UK — Emergency treatment of anaphylaxis (2021) (`rcuk-anaphylaxis`)

Anaphylaxis recognition.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### RxNorm (NLM) (`rxnorm`)

Normalized names and identifiers (RXCUI) for clinical drugs; ingredient, strength, dose form, brand relationships.

- Recommended use: Canonical ingredient identifiers. RXCUIs in the seed set are curated and must be verified with `npm run import:rxnav`.
- Fields used: rxcui (curated, to be verified by importer)
- Redistribution: permitted-with-conditions; attribution required — “This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.”
- Update frequency: Monthly full; weekly updates
- Notes: RxNav API is not reachable from the build sandbox; verification pending.

### Sepsis-3 / qSOFA (Singer et al., JAMA 2016) (`sepsis-3`)

qSOFA bedside criteria.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### Siddhanta Kosha (`siddhanta-kosha`)

Ayurvedic principles (dosha, agni, ama, virya…) with shloka references.

- Recommended use: Principle layer for rationale text.
- Fields used: name, category, shloka, shlokaRef, explanation, clinicalImportance
- Redistribution: permitted-with-conditions; attribution required — “Varshney S. (Amidha Ayurveda), Siddhanta Kosha, DOI 10.5281/zenodo.17481343, CC BY 4.0.”
- Update frequency: Static release

### SNOMED CT (`snomed-ct`)

Clinical terminology.

- Recommended use: Future mapping under licence.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Monthly/biannual
- Notes: No SNOMED codes bundled or invented.

### Synthea synthetic patients (`synthea`)

Generates synthetic FHIR patient records.

- Recommended use: Test fixtures via scripts/import/import-synthea-fhir.ts.
- Fields used: FHIR Bundle → case model (importer)
- Redistribution: permitted
- Update frequency: Active
- Notes: A minimal hand-written FHIR fixture is included for tests; full Synthea output is user-generated.

### Therapeutics Data Commons (`tdc`)

Therapeutic ML datasets.

- Recommended use: Future R&D only; not for clinical candidates.
- Fields used: none
- Redistribution: unclear; attribution required
- Update frequency: Irregular

### Tele-MANAS (MoHFW) mental health helpline 14416 (`tele-manas`)

India national tele-mental-health service.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### VedAssist2 (`vedassist2`)

Ayurveda AI/case-taking/RAG implementation.

- Recommended use: Case-taking/RAG pattern reference only.
- Fields used: none
- Redistribution: unclear
- Update frequency: Irregular
- Notes: Recommendations are not clinically validated; no data or model outputs used.

### WHO ATC/DDD Index (WHOCC) (`who-atc`)

Anatomical Therapeutic Chemical classification and Defined Daily Doses.

- Recommended use: User-supplied ATC file adapter only.
- Fields used: none
- Redistribution: not-permitted; attribution required
- Update frequency: Annual (January)
- Notes: ATC codes are NOT bundled and not invented; drug classes use internal class tags.

### WHO/TDR Dengue guidelines for diagnosis, treatment, prevention and control (2009) (`who-dengue-2009`)

Dengue warning signs; avoid aspirin/NSAIDs.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### WHO Model List of Essential Medicines (`who-eml`)

International reference list of essential medicines.

- Recommended use: International reference; not imported.
- Fields used: none
- Redistribution: permitted-with-conditions; attribution required
- Update frequency: Biennial
- Notes: Non-commercial licence; not bundled.

### WHO Emergency Triage Assessment and Treatment (ETAT) (`who-etat`)

Paediatric emergency signs.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

### WHO Integrated Management of Childhood Illness (IMCI) (`who-imci`)

General danger signs in children under 5.

- Recommended use: Red-flag rule citation.
- Fields used: rule logic encoded as paraphrased criteria
- Redistribution: not-permitted; attribution required
- Update frequency: Periodic
- Notes: Criteria encoded as rules; text not reproduced.

