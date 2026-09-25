# data/

| Path | Contents | In git / ZIP |
|---|---|---|
| `master-medical-knowledge.json` | Canonical knowledge layer (built) | yes |
| `source-registry.json` | 76 sources with level, licence, integration | yes |
| `validation-report.json` | Last validation result | yes |
| `curated/` | Hand-curated inputs with provenance | yes |
| `processed/ayurveda/` | Importer output, CC BY 4.0 (attribution in DATA_LICENSES.md) | yes |
| `processed/homeopathy/` | Repertory and materia medica packs, GPL-3.0 | yes |
| `processed/allopathy/` | Optional verifier outputs (openFDA, RxNav, user ATC) | yes (empty in v1.0.0) |
| `imports/` | Raw third-party downloads used by importers | no — re-fetched by importers |
| `staging/`, `backups/` | `knowledge:update` working files | no |
| `runtime/` | Cases, analyses, audit log (patient data) | **never** |
