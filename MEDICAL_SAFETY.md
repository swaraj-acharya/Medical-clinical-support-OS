# Medical safety

## Intended use

Decision support and reference for **qualified clinicians** (allopathic, Ayurvedic or homeopathic practitioners) during
outpatient consultations. The clinician remains responsible for assessment, diagnosis, choice of treatment, dose and
follow-up. The software:

- does **not** diagnose — clinical-context matches describe feature fit and are labelled as such;
- does **not** prescribe or dose — dosing text is a pointer to the label, and Ayurvedic doses are shown only as
  statements of the source, never as recommendations;
- does **not** replace emergency assessment — emergency red flags block all candidates;
- does **not** rank systems against each other — each system uses its own method, and scores are not comparable;
- does **not** claim efficacy for traditional systems — Ayurvedic items carry *traditional/classical* labels and an
  explicit statement when no modern evidence is recorded; homeopathic results are *repertory references* shown next to
  the NHMRC (2015) and RACGP positions.

Not intended for: patients or the public; emergency triage as the only safeguard; children or pregnant women without
specialist oversight; any use before the governance checklist below is complete.

## Built-in safeguards

1. **Safety engine runs first** (31 rules). Emergency → no candidates. Urgent → candidates withheld until a clinician
   records an assessment of every urgent rule, with a reason (audit-logged). Emergency flags cannot be acknowledged away.
2. **Missing data is not reassurance.** Missing vitals are listed as not evaluated; *No conflict in entered data* is used
   instead of “safe”; missing pregnancy/breastfeeding data for a medicine is disclosed.
3. **Conservative Indian defaults.** Fever sets a dengue-risk tag that withholds NSAIDs/aspirin until the clinician
   asserts dengue is excluded. Thrombocytopenia and uncontrolled BP derive their own tags.
4. **Medication checks** — allergy (drug, ingredient, class), contraindications and warnings (age, pregnancy ≥20 weeks,
   breastfeeding, renal incl. eGFR, hepatic, conditions), drug–drug interactions (drug and class), duplicate therapy
   (including ingredients hidden in brands such as Combiflam), and review of the patient's current regimen.
5. **Ayurveda** — Rasaushadhi (mineral/metal) formulations always flagged, and excluded in pregnancy, breastfeeding,
   patients under 18 or with renal impairment; LiverTox herb notes; herb–drug review when the patient takes
   anticoagulants, antiplatelets, antidiabetics, antihypertensives, SSRIs or narrow-therapeutic-index drugs;
   pregnancy/breastfeeding disclosure on every item.
6. **Homeopathy** — toxic source materials (23 flagged remedies, e.g. Belladonna, Aconitum, Lachesis) shown as warnings;
   population disclosures for pregnancy and young children; auto-suggested rubrics labelled provisional.
7. **Traceability** — every analysis stores the knowledge-base version and hash; decisions and acknowledgements are in
   a tamper-evident audit log.
8. **Deterministic by default** — no language model in the recommendation path.

## Research prompts

Each section can generate a research prompt for an external AI tool (see RESEARCH_PROMPTS.md). The prompts require
verifiable citations, evidence labels and an explicit uncertainty section, but the AI output is not checked by this app
and is never fed back into it. Clinicians must verify every reference before acting on it, and must not delay emergency
care to run research.

## Known clinical limits of v1.0.0

- Allopathic drug facts (18 medicines, 13 interaction rules) are **hand-curated seeds, pending verification** against
  current labels. The openFDA and RxNav verifiers could not run in the build environment.
- Clinical scope is a seed: six allopathic contexts. Anything outside them returns an explicit *no context matched*.
- Interaction coverage is not comprehensive; a pharmacist-grade interaction database is required for production.
- Brand compositions (Indian brands) are curated and must be checked against current product information.
- Ayurveda term bridges are approximate correlates, not NAMASTE mappings; classical indications come from a single
  open dataset (level 4) and are not verified against the primary texts.
- Red-flag rules encode published criteria in simplified form; they have not been validated prospectively.
- No dosing, no paediatric weight-based logic, no renal dose adjustment.

## Clinical-governance checklist (required before any real-patient use)

- [ ] Appoint a clinical safety officer; complete a hazard log and clinical risk assessment for the deployment.
- [ ] Verify every `curated-pending-verification` entity against its cited source (Data health lists them); run
      `import:openfda` and `import:rxnav` on a networked machine and review mismatches.
- [ ] Review red-flag rules with emergency-medicine, obstetric and paediatric clinicians; test with local case sets.
- [ ] Replace or supplement the interaction rules with a licensed, maintained interaction database.
- [ ] Verify Indian brand compositions and NLEM/STG alignment; add ICMR/MoHFW guidance where it applies.
- [ ] Ayurveda: review bridges and safety rules with a qualified Ayurvedic physician; load licensed NAMASTE codes.
- [ ] Homeopathy: review the toxic-source list with a pharmacist; confirm the evidence statements displayed.
- [ ] Confirm regulatory status for the intended use (CDSCO Medical Device Rules 2017 treat some clinical software as a
      medical device; check whether this deployment falls in scope).
- [ ] Privacy impact assessment (DPDP Act 2023), access control, encryption at rest, backups, retention policy.
- [ ] User training, including the meaning of each metric and the limits above; incident-reporting route.
- [ ] Re-run `npm run check` and the demo scenarios after every knowledge-base update.
