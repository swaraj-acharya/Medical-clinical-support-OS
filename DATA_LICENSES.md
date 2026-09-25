# Data licences and obligations

This repository contains **code** and **data**. The data components carry their own licences, listed here. Nothing in
this project grants rights beyond those licences. Sources that cannot be redistributed are **not bundled** — they are
linked, or imported by the user from a copy they are licensed to use.

## Bundled data

### Repertorium Publicum (via OOREP) — GPL-3.0-or-later
- Files: `data/processed/homeopathy/publicum.pack.json.gz` (full repertory: rubrics, remedies, grades) and the rubric
  subset copied into `data/master-medical-knowledge.json`.
- Attribution: *Repertorium Publicum* by Vladimir Polony (2008), distributed with OOREP
  (https://www.oorep.com, https://github.com/nondeterministic/oorep) under the GNU General Public License v3.
- Obligation: if you distribute these files (or a work containing them), you must do so under GPL-3.0 terms, include
  the licence text (`LICENSES/GPL-3.0.txt`) and make the corresponding source (this repository's importer
  `scripts/import/import-oorep.ts` and the pack) available. Keep the data files separable from proprietary code if you
  do not intend to license the application under the GPL; seek legal advice on your distribution model.

### Boericke, *Pocket Manual of Homoeopathic Materia Medica* (1906)
- File: `data/processed/homeopathy/boericke.pack.json.gz`.
- The text was first published in 1906 and is in the public domain; the transcription used is distributed within the
  GPL-3.0 OOREP repository, so treat the transcription as GPL-3.0 as above.

### Amidha Ayurveda open datasets — CC BY 4.0
- Files: `data/processed/ayurveda/{herbs,formulations,principles}.json` and the corresponding collections in the master file.
- Required attribution (reproduce in any redistribution or public display):
  - Varshney S. (Amidha Ayurveda), *Herb Database* v2.0.0, DOI 10.5281/zenodo.17475351, CC BY 4.0.
  - Varshney S. (Amidha Ayurveda), *Bhaishajya Kalpana Kosha* v1.0.0, DOI 10.5281/zenodo.18243950, CC BY 4.0.
  - Varshney S. (Amidha Ayurveda), *Siddhanta Kosha*, DOI 10.5281/zenodo.17481343, CC BY 4.0.
- Changes made: fields normalised and renamed; promotional preview text and image links not imported; formulations
  flagged for mineral/metal content; one duplicate formulation record dropped; safety notes added from other sources.
  Licence: https://creativecommons.org/licenses/by/4.0/

### Project curated layer (`cds-curated`)
- Files: `data/curated/*.json`. Written for this project as paraphrases and rule encodings of the cited sources. No
  guideline, label or monograph text is reproduced beyond short factual statements. Licensed with the project.

## Data obtained through APIs (not bundled in this build)

- **RxNorm / RxNav (NLM)** — the importer checks RXCUIs through public APIs. Required statement when results are
  included: *“This product uses publicly available data from the U.S. National Library of Medicine (NLM), National
  Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not
  endorse or recommend this or any other product.”* The full RxNorm release requires a UMLS licence and is not used.
- **openFDA / DailyMed** — label metadata only (set ID, effective date, sections present); label text is linked, not
  copied. openFDA data are public domain (CC0); openFDA states it is not for clinical decision-making without validation.

## User-supplied (licence prevents redistribution)

WHO ATC/DDD (WHOCC), NAMASTE (Ministry of AYUSH), DrugCentral (CC BY-SA 4.0 — share-alike would affect the master file;
kept external), SNOMED CT (affiliate licence via NRCeS), MIMIC-IV (credentialed DUA). Import with
`npm run import:user` where supported; do not commit the resulting files to a public repository.

## Linked only

NICE, ICMR, MoHFW, NLEM, CDSCO, WHO guidance, ICHD-3, NHS Scotland, RCEM, RCP, Resuscitation Council UK, LiverTox,
NHMRC, RACGP, NCH, CCRH, CCRAS, PCIM&H (API/AFI), Cochrane, PubMed. These are cited with URLs; their text is not copied.

## Fonts and code dependencies

Public Sans and Source Serif 4 (SIL Open Font License 1.1) via @fontsource. npm dependencies retain their own licences
(see `package-lock.json`).

The complete per-source table is in [DATA_SOURCES.md](DATA_SOURCES.md).
