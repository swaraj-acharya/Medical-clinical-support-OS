Optional verification outputs merged by `npm run knowledge:build` when present:

- `openfda-labels.json` — from `npm run import:openfda` (needs internet access to api.fda.gov)
- `rxnorm-verification.json` — from `npm run import:rxnav` (needs internet access to rxnav.nlm.nih.gov)
- `atc-user-supplied.json` — from `npm run import:user -- --atc <file.csv>` (WHO ATC licence held by the user)

None were produced in the v1.0.0 build environment (no access to those hosts).
