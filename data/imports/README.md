# data/imports/

Raw downloads used by the importers. Not committed and not shipped.

- `oorep/` — OOREP SQL dump (`npm run import:oorep` downloads it from the OOREP GitHub repository if absent).
- `ayurveda/` — Amidha Ayurveda JSON files (`npm run import:ayurveda` downloads them from GitHub if absent).

User-licensed files (WHO ATC, NAMASTE) can be kept here and imported with `npm run import:user -- --atc <file>` /
`--namaste <file>`. Do not publish them.
