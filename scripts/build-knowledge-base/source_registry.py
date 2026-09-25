"""Generates data/source-registry.json. Kept as a script so edits are reviewable; run: python3 scripts/build-knowledge-base/source_registry.py"""
import json, os
T = "2026-09-25"
R = []
def e(id, name, system, type, level, url, description, codeLicense, dataLicense, commercialUse, redistribution, attributionRequired,
      integration, dataCopied, importedFields, updateFrequency, status, recommendedUse, provenance, notes, attributionText=None, lastUpstreamUpdate=None):
    d = dict(id=id, name=name, system=system, type=type, level=level, url=url, description=description, codeLicense=codeLicense,
             dataLicense=dataLicense, commercialUse=commercialUse, redistribution=redistribution, attributionRequired=attributionRequired,
             integration=integration, dataCopied=dataCopied, importedFields=importedFields, updateFrequency=updateFrequency,
             lastChecked=T, status=status, recommendedUse=recommendedUse, provenance=provenance, notes=notes)
    if attributionText: d["attributionText"] = attributionText
    if lastUpstreamUpdate: d["lastUpstreamUpdate"] = lastUpstreamUpdate
    R.append(d)

# ---------------- shared / internal ----------------
e("cds-curated","CDS curated clinical layer","shared","hand-curated rules and lexicon",4,"KNOWLEDGE_BASE.md",
  "Hand-authored lexicon (symptom synonyms incl. romanised Hindi), red-flag rule encodings, application safety rules and terminology bridges written for this project, each citing its upstream authority.",
  "Project licence","Project content","permitted","permitted",False,"bundled-import",True,["symptoms","red-flag rule logic","context features","bridges"],
  "Per knowledge-base release","active","Seed rules; every fact is marked curated-pending-verification until clinical-governance sign-off.",
  "Authored during this build from the cited primary sources.","Not an authority in itself. Requires review by a clinical safety officer before clinical use.")

# ---------------- allopathy: India ----------------
e("icmr-amu","ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes","allopathy","clinical guideline",1,"https://www.icmr.gov.in/guidelines",
  "ICMR national guidance on antimicrobial use in common infectious syndromes (2nd edition 2019; revised edition Nov 2022 found).",None,"© ICMR — all rights reserved","restricted","not-permitted",True,
  "reference-link",False,[],"Irregular (multi-year)","active","Cite by link for antimicrobial stewardship statements; paraphrase only.","Official ICMR publication.",
  "Content not copied. The URTI 'no antibiotics' rule cites this guideline by link and paraphrase.")
e("mohfw-stg","MoHFW / Clinical Establishments Standard Treatment Guidelines","allopathy","clinical guideline",1,"https://clinicalestablishments.mohfw.gov.in/en/standard-treatment-guidelines",
  "Standard treatment guidelines across specialties (cardiology, critical care, obstetrics, paediatrics, dengue, snakebite, rabies, malaria, etc.).",None,"Government of India publication (reuse terms not stated)","unclear","unclear",True,
  "reference-link",False,[],"Irregular","active","Primary India-first guideline reference; link and paraphrase.","Official MoHFW portal.",
  "PDF guidelines not bundled because reuse terms are not explicit. Future importer should record guideline title/version/date as metadata only.")
e("nlem","National List of Essential Medicines (India) 2022","allopathy","essential medicines list",1,"https://cdsco.gov.in/",
  "NLEM 2022: 384 medicines in 27 therapeutic categories (latest version found).",None,"Government of India publication","unclear","unclear",True,
  "metadata-only",False,[],"~3–5 years","active","Flag whether a candidate is on NLEM (future importer).","Official MoHFW/CDSCO publication.",
  "NLEM membership not yet imported; importer stub planned. No NLEM status is displayed to avoid unverified claims.")
e("cdsco","Central Drugs Standard Control Organisation (CDSCO)","allopathy","regulator",1,"https://cdsco.gov.in/",
  "Indian drug regulator: approvals, banned FDC lists, safety alerts.",None,"Government of India publication","unclear","unclear",True,"reference-link",False,[],"Continuous","active",
  "Reference for Indian approval status and banned fixed-dose combinations.","Official regulator.","Not imported.")
e("pvpi","Pharmacovigilance Programme of India (PvPI)","allopathy","pharmacovigilance",1,"https://www.ipc.gov.in/PvPI/about.html",
  "National ADR reporting programme run by the Indian Pharmacopoeia Commission.",None,"Government of India","unclear","unclear",True,"reference-link",False,[],"Continuous","active",
  "Link from adverse-effect sections for ADR reporting.","Official programme.","No bulk data API found.")
# ---------------- allopathy: international ----------------
e("rxnorm","RxNorm (NLM)","allopathy","drug terminology",1,"https://www.nlm.nih.gov/research/umls/rxnorm/index.html",
  "Normalized names and identifiers (RXCUI) for clinical drugs; ingredient, strength, dose form, brand relationships.",None,
  "Full release requires UMLS licence; Current Prescribable Content and RxNav APIs available without licence","permitted","permitted-with-conditions",True,
  "api-adapter",False,["rxcui (curated, to be verified by importer)"],"Monthly full; weekly updates","active",
  "Canonical ingredient identifiers. RXCUIs in the seed set are curated and must be verified with `npm run import:rxnav`.",
  "NLM. RxClass content includes SNOMED CT (affiliate licence).","RxNav API is not reachable from the build sandbox; verification pending.",
  attributionText="This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.")
e("dailymed","DailyMed (NLM) — Structured Product Labeling","allopathy","drug labels",1,"https://dailymed.nlm.nih.gov/",
  "FDA-submitted product labels: indications, contraindications, warnings, boxed warnings, interactions, adverse reactions.",None,"US Government work (labels are public)","permitted","permitted",False,
  "reference-link",False,["label section facts (curated paraphrase)"],"Daily","active","Label source for contraindications/warnings; link each drug to DailyMed search.",
  "NLM hosts manufacturer labels.","Seed facts paraphrased from labels; openFDA label importer verifies sections when network is available.")
e("openfda","openFDA drug APIs","allopathy","drug labels / adverse events API",1,"https://open.fda.gov/apis/drug/",
  "Drug label, adverse event (FAERS), NDC, recall, Drugs@FDA, shortages endpoints.",None,"Public domain (CC0) with openFDA terms; not for clinical decision-making without validation","permitted","permitted",False,
  "api-adapter",False,[],"Weekly","active","Verify/refresh label sections via scripts/import/import-openfda-labels.ts.","FDA.",
  "FAERS reports are not causal evidence. api.fda.gov is not reachable from the build sandbox.")
e("drugcentral","DrugCentral","allopathy","drug knowledge base",2,"https://drugcentral.org/download",
  "Drug indications, contraindications, targets, pharmacologic actions, identifiers.",None,"CC BY-SA 4.0","permitted","permitted-with-conditions",True,
  "user-supplied-import",False,[],"Irregular (latest dump 2023-11-01)","stale","Enrichment of indications/targets via user-run import (share-alike obligations apply to derived data).",
  "University of New Mexico.","Not bundled to keep the core dataset free of share-alike obligations; adapter documented.",lastUpstreamUpdate="2023-11-01")
e("who-atc","WHO ATC/DDD Index (WHOCC)","allopathy","drug classification",1,"https://atcddd.fhi.no/",
  "Anatomical Therapeutic Chemical classification and Defined Daily Doses.",None,"© WHOCC; index sold; no commercial use without permission","prohibited","not-permitted",True,
  "user-supplied-import",False,[],"Annual (January)","active","User-supplied ATC file adapter only.","WHO Collaborating Centre, Oslo.",
  "ATC codes are NOT bundled and not invented; drug classes use internal class tags.")
e("who-eml","WHO Model List of Essential Medicines","allopathy","essential medicines list",1,"https://www.who.int/publications/i/item/B09474",
  "International reference list of essential medicines.",None,"CC BY-NC-SA 3.0 IGO (WHO publications)","restricted","permitted-with-conditions",True,"reference-link",False,[],"Biennial","active",
  "International reference; not imported.","WHO.","Non-commercial licence; not bundled.")
e("nice","NICE guidance","allopathy","clinical guideline",1,"https://www.nice.org.uk/guidance",
  "UK national guidelines used as international references (CG150 headache, CG184 dyspepsia, NG84 sore throat, NG51/NG143 sepsis/fever, NG232 head injury, etc.).",None,
  "© NICE — reuse requires permission; UK-specific","restricted","not-permitted",True,"reference-link",False,[],"Continuous","active",
  "Cited by link with paraphrased statements; used where no verified Indian guideline was available.","NICE.","No NICE text is reproduced.")
e("ichd-3","ICHD-3 (International Headache Society)","allopathy","diagnostic criteria",1,"https://ichd-3.org",
  "International Classification of Headache Disorders, 3rd edition (2018).",None,"© IHS (Cephalalgia)","restricted","not-permitted",True,"reference-link",False,[],"Rare","active",
  "Feature list for migraine/tension-type contexts (features named, criteria text not reproduced).","IHS.","")
e("aria","ARIA guidelines (allergic rhinitis)","allopathy","clinical guideline",1,"https://www.jacionline.org/",
  "Allergic Rhinitis and its Impact on Asthma guideline revision (2016).",None,"Journal copyright","restricted","not-permitted",True,"reference-link",False,[],"Periodic","active","Reference for allergic rhinitis context.","ARIA / J Allergy Clin Immunol.","")
e("pubchem","PubChem","allopathy","chemical database",2,"https://pubchem.ncbi.nlm.nih.gov/","Chemical identifiers, structures, synonyms.",None,"Public domain (NCBI) with per-source exceptions","permitted","permitted-with-conditions",False,
  "api-adapter",False,[],"Continuous","active","Future chemical identifier enrichment.","NCBI; aggregates depositor data.","Not imported in v1.")
e("chembl","ChEMBL","allopathy","bioactivity / mechanism database",2,"https://www.ebi.ac.uk/chembl/","Targets, mechanisms of action, bioactivity.",None,"CC BY-SA 3.0","permitted","permitted-with-conditions",True,
  "user-supplied-import",False,[],"~2 releases/year","active","Future mechanism-of-action enrichment.","EMBL-EBI.","Not imported (share-alike).")
e("primekg","PrimeKG","allopathy","biomedical knowledge graph",4,"https://github.com/mims-harvard/PrimeKG","Precision-medicine knowledge graph integrating 20 resources.","MIT","Mixed (inherits licences of 20 upstream sources)","unclear","unclear",True,
  "architecture-reference",False,[],"Last commit 2026-06-30","active","Schema reference only; OptimusKG preferred as successor.","Harvard MIMS lab.","Upstream licences heterogeneous; not bundled.")
e("optimuskg","OptimusKG","allopathy","biomedical knowledge graph",4,"https://github.com/mims-harvard/OptimusKG","Newer MIMS biomedical knowledge graph with provenance metadata.","MIT","Mixed (per upstream source)","unclear","unclear",True,
  "architecture-reference",False,[],"Last commit 2026-09-21","active","Graph edge vocabulary reference; future import behind per-source licence filter.","Harvard MIMS lab.","Not bundled.")
e("ibkh","iBKH (integrative Biomedical Knowledge Hub)","allopathy","biomedical knowledge graph",4,"https://github.com/wcm-wanglab/iBKH","Drug, disease, symptom, side-effect, gene relations.","No root licence file found","Mixed / unclear","unclear","unclear",True,
  "architecture-reference",False,[],"Irregular","unverified","Reference only until licence clarified.","Weill Cornell.","No licence file at repository root.")
e("hetionet","Hetionet","allopathy","biomedical knowledge graph",4,"https://github.com/hetio/hetionet","Integrative network of compounds, diseases, genes, side effects, symptoms.","No root licence file found","Mixed (per-source; some non-commercial)","unclear","unclear",True,
  "architecture-reference",False,[],"Last update 2023","stale","Relationship-type reference.","Himmelstein et al.","Stale; not bundled.",lastUpstreamUpdate="2023")
e("tdc","Therapeutics Data Commons","allopathy","ML benchmark datasets",4,"https://github.com/mims-harvard/TDC","Therapeutic ML datasets.","MIT","Per dataset","unclear","unclear",True,"architecture-reference",False,[],"Irregular","active","Future R&D only; not for clinical candidates.","Harvard MIMS lab.","")
e("synthea","Synthea synthetic patients","shared","synthetic EHR generator",4,"https://github.com/synthetichealth/synthea","Generates synthetic FHIR patient records.","Apache-2.0","Synthetic (no real patients)","permitted","permitted",False,
  "user-supplied-import",False,["FHIR Bundle → case model (importer)"],"Active","active","Test fixtures via scripts/import/import-synthea-fhir.ts.","MITRE.","A minimal hand-written FHIR fixture is included for tests; full Synthea output is user-generated.")
e("mimic-iv","MIMIC-IV / MIMIC-IV-Note (PhysioNet)","shared","clinical database",2,"https://physionet.org/","De-identified ICU records and clinical notes.",None,"PhysioNet Credentialed Health Data Licence (training + DUA required)","restricted","not-permitted",True,
  "metadata-only",False,[],"Versioned releases","active","Future clinical NLP research under credentialed access only.","MIT LCP.","Never bundled.")
e("clinicaltrials","ClinicalTrials.gov","shared","trial registry",2,"https://clinicaltrials.gov/","Registered clinical studies (API v2).",None,"Public (US Government)","permitted","permitted",False,"reference-link",False,[],"Daily","active","Future evidence layer.","NLM.","Not imported.")
e("pubmed","PubMed","shared","bibliographic database",3,"https://pubmed.ncbi.nlm.nih.gov/","Citations for peer-reviewed studies.",None,"Citations public; article text per publisher","permitted","permitted-with-conditions",False,"reference-link",False,["citation metadata"],"Daily","active","Citation links for studies.","NLM.","Only citation metadata stored.")
e("cochrane","Cochrane Library","shared","systematic reviews",3,"https://www.cochranelibrary.com/","Systematic reviews.",None,"Publisher copyright","restricted","not-permitted",True,"reference-link",False,["citation"],"Continuous","active","Citation links.","Cochrane.","")
e("fda","US Food and Drug Administration","shared","regulator",1,"https://www.fda.gov/","Safety communications (e.g., 2017 homeopathic belladonna teething tablets).",None,"Public (US Government)","permitted","permitted",False,"reference-link",False,[],"Continuous","active","Safety communications.","FDA.","")
e("fda-dsc","FDA Drug Safety Communications","allopathy","regulatory safety communication",1,"https://www.fda.gov/drugs/drug-safety-and-availability/drug-safety-communications","FDA drug safety alerts and communications (e.g., 2006 triptan + SSRI/SNRI serotonin syndrome alert).",None,"Public (US Government)","permitted","permitted",False,"reference-link",False,[],"Continuous","active","Cite safety communications by title/date.","FDA.","Content paraphrased; not copied.")
e("mhra","UK Medicines and Healthcare products Regulatory Agency (MHRA)","allopathy","regulator",1,"https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency","UK regulator; Drug Safety Update and historical CSM advice (e.g., aspirin and Reye's syndrome under 16).",None,"Open Government Licence v3.0 (most GOV.UK content)","permitted","permitted-with-conditions",True,"reference-link",False,[],"Monthly (Drug Safety Update)","active","Cite regulatory safety advice.","MHRA.","Paraphrased only.",attributionText="Contains public sector information licensed under the Open Government Licence v3.0.")
e("ema","European Medicines Agency (EMA)","allopathy","regulator",1,"https://www.ema.europa.eu/","EU regulator; referral outcomes and safety restrictions (e.g., 2013 metoclopramide restrictions).",None,"EMA content reusable with acknowledgement (per EMA legal notice)","permitted","permitted-with-conditions",True,"reference-link",False,[],"Continuous","active","Cite referral outcomes / safety restrictions.","EMA.","Paraphrased only.")
e("fhir","HL7 FHIR R4/R5","shared","interoperability standard",1,"https://hl7.org/fhir/","Resource definitions (Patient, Condition, Observation, AllergyIntolerance, MedicationStatement, Encounter).",None,"CC0 (specification)","permitted","permitted",False,
  "architecture-reference",False,[],"Periodic","active","Case model mapping (lib/fhir).","HL7.","")
e("snomed-ct","SNOMED CT","shared","clinical terminology",1,"https://www.snomed.org/","Clinical terminology.",None,"Affiliate licence (India is a member country via NRCeS)","restricted","not-permitted",True,"metadata-only",False,[],"Monthly/biannual","active",
  "Future mapping under licence.","SNOMED International.","No SNOMED codes bundled or invented.")
e("icd","WHO ICD-10 / ICD-11","shared","classification",1,"https://icd.who.int/","Disease classification.",None,"ICD-11 CC BY-ND 3.0 IGO; ICD-10 © WHO","restricted","permitted-with-conditions",True,"bundled-subset",True,["a few ICD-10/ICD-11 codes on curated concepts"],"Annual","active",
  "Display codes only, each marked pending verification.","WHO.","Codes are few, hand-entered, and flagged for verification.")
e("livertox","LiverTox (NIDDK/NLM)","shared","drug/herb hepatotoxicity reference",1,"https://www.ncbi.nlm.nih.gov/books/NBK547852/","Clinical and research information on drug- and supplement-induced liver injury.",None,"Public (US Government)","permitted","permitted",False,
  "reference-link",False,["ashwagandha hepatotoxicity note (paraphrase)"],"Continuous","active","Herb hepatotoxicity notes.","NIDDK / NLM.","")
# ---------------- red flags ----------------
for sid,name,url,desc,lic in [
 ("nhs-scotland-headache","NHS Scotland National Headache Pathway","https://www.rightdecisions.scot.nhs.uk/borders-ref-help-toolkit/headache/1-national-headache-pathway/","Headache red flags.","© NHS Scotland"),
 ("rcem-learning","RCEM Learning","https://www.rcemlearning.co.uk/","Emergency medicine red-flag teaching.","© RCEM"),
 ("who-etat","WHO Emergency Triage Assessment and Treatment (ETAT)","https://www.who.int/publications/i/item/9241546875","Paediatric emergency signs.","© WHO (CC BY-NC-SA IGO for newer items)"),
 ("who-imci","WHO Integrated Management of Childhood Illness (IMCI)","https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/integrated-management-of-childhood-illness","General danger signs in children under 5.","© WHO"),
 ("sepsis-3","Sepsis-3 / qSOFA (Singer et al., JAMA 2016)","https://jamanetwork.com/journals/jama/fullarticle/2492881","qSOFA bedside criteria.","Journal copyright"),
 ("rcuk-anaphylaxis","Resuscitation Council UK — Emergency treatment of anaphylaxis (2021)","https://www.resus.org.uk/library/additional-guidance/guidance-anaphylaxis/emergency-treatment","Anaphylaxis recognition.","© RCUK"),
 ("rcp-news2","Royal College of Physicians — NEWS2","https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/","Early warning score thresholds.","© RCP"),
 ("who-dengue-2009","WHO/TDR Dengue guidelines for diagnosis, treatment, prevention and control (2009)","https://www.who.int/publications/i/item/9789241547871","Dengue warning signs; avoid aspirin/NSAIDs.","© WHO"),
 ("tele-manas","Tele-MANAS (MoHFW) mental health helpline 14416","https://telemanas.mohfw.gov.in/","India national tele-mental-health service.","Government of India")]:
    e(sid,name,"shared","red-flag / emergency guidance",1,url,desc,None,lic,"restricted" if "©" in lic or "copyright" in lic.lower() else "unclear","not-permitted",True,"reference-link",False,["rule logic encoded as paraphrased criteria"],"Periodic","active",
      "Red-flag rule citation.","Official/professional body.","Criteria encoded as rules; text not reproduced.")
# ---------------- homeopathy ----------------
e("oorep","OOREP — Repertorium Publicum","homeopathy","repertory database",4,"https://github.com/nondeterministic/oorep",
  "Open online repertory. The SQL dump contains several repertories; only 'publicum' (Repertorium Publicum, V. Polony 2008, English) is imported.","GPL-3.0",
  "GPL v3 (declared in dump info table for publicum)","permitted","permitted-with-conditions",True,"bundled-import",True,
  ["remedies (2,432)","rubrics (74,667)","rubric–remedy grades (735,566)"],"Repository active (last commit 2026-08-08)","active",
  "Primary repertory for rubric hierarchy and repertorization.","Imported from oorep.sql.gz with SHA-256 recorded in manifest.",
  "Kent-de and other repertories in the dump are not imported (language/licence scope). Derived pack and master subset are GPL-3.0.",
  attributionText="Repertorium Publicum by Vladimir Polony (2008), distributed with OOREP (https://www.oorep.com) under GPL v3.",lastUpstreamUpdate="2026-08-08")
e("oorep-boericke","Boericke — Pocket Manual of Homoeopathic Materia Medica (1906) via OOREP","homeopathy","materia medica",4,"https://github.com/nondeterministic/oorep",
  "Materia medica text first published 1906 (public domain); transcription distributed within the OOREP repository.","GPL-3.0","Public-domain text; transcription in GPL-3.0 repository","permitted","permitted-with-conditions",True,
  "bundled-import",True,["688 remedy chapters with section headings and text"],"Static","active","Materia-medica comparison for candidate remedies.","Imported from oorep.sql.gz.",
  "Licence field null in dump; treated as public-domain text inside GPL repo.")
e("oorep-mcp","oorep-mcp","homeopathy","MCP server",5,"https://github.com/Dhi13man/oorep-mcp","MCP server exposing OOREP search.","MIT","No data (queries oorep.com)","permitted","permitted",False,"architecture-reference",False,[],"Last commit 2026-09-11","active",
  "Design reference for structured repertory retrieval tools.","GitHub.","")
e("oorep-local-repertory","oorep-local-repertory","homeopathy","local repertory app",5,"https://github.com/drwjkirkpatrick-web/oorep-local-repertory","Offline repertory claiming 143,408 rubrics / 1.36M links built on OOREP data.","GPL-3.0","Derived from OOREP; expanded corpus provenance unclear","unclear","unclear",True,
  "architecture-reference",False,[],"Last commit 2026-08-02","unverified","Clinical phrase→rubric mapping ideas only.","GitHub.","Not bundled: provenance of the expanded corpus is not documented; README describes an XOR-stream cipher (weak security).")
e("openhomeopath","OpenHomeopath","homeopathy","repertory application",5,"https://github.com/henri-hulski/OpenHomeopath","PHP repertory app with SQL dump.","No root licence file","Unclear","unclear","unclear",True,"architecture-reference",False,[],"Last commit 2022-05-12","stale",
  "Data-model reference only.","GitHub.","No licence file at root; SQL not imported.",lastUpstreamUpdate="2022-05-12")
e("myhomeo","myhomeo","homeopathy","materia medica JSON",5,"https://github.com/mannasoumya/myhomeo","medicines4.json (688 entries) scraped from Boericke at homeoint.","MIT (code)","Scraped third-party transcription","unclear","unclear",True,"architecture-reference",False,[],"Irregular","unverified",
  "JSON-structure reference only.","GitHub.","Data scraped from homeoint; not bundled (Boericke obtained from OOREP instead).")
e("kent-repertory-etl","kent_repertory_etl","homeopathy","ETL pipeline",5,"https://github.com/aadjones/kent_repertory_etl","Hierarchical→relational ETL for Kent repertory HTML.","MIT","Scraped HTML (285 files) of third-party site","unclear","not-permitted",True,"architecture-reference",False,[],"Last commit 2025-02-06","active",
  "Parent/child rubric ETL pattern reference.","GitHub.","Raw scraped HTML not used.")
e("openrep-deutsch","OpenRep-Deutsch","homeopathy","repertory (German)",5,"https://github.com/nondeterministic/OpenRep-Deutsch","German repertory project.","GPL-3.0","GPL-3.0","permitted","permitted-with-conditions",True,"architecture-reference",False,[],"Last commit 2018","stale","Navigation/repertorization approach reference.","GitHub.","German; not imported.",lastUpstreamUpdate="2018")
e("hydrogen2oxygen-repertory","hydrogen2oxygen/repertory","homeopathy","repository",6,"https://github.com/hydrogen2oxygen/repertory","Repository contains only README and LICENSE.","MIT","No data","not-applicable","not-applicable" if False else "unclear",False,"metadata-only",False,[],"Last commit 2020","stale","None — no usable data.","GitHub.","Empty repository.")
e("ccrh","Central Council for Research in Homoeopathy (CCRH)","homeopathy","research council",1,"https://ccrhindia.ayush.gov.in/","Standard Treatment Guidelines, clinical verification, research publications.",None,"Government of India (reuse terms not stated)","unclear","unclear",True,"reference-link",False,[],"Irregular","active",
  "India-first homeopathy reference; STGs linked.","Ministry of AYUSH.","PDFs not bundled.")
e("ccrh-stg","CCRH Standard Treatment Guidelines in Homoeopathy","homeopathy","treatment guideline",1,"https://ccrhindia.ayush.gov.in/publications/STG","STG publications.",None,"Government of India","unclear","unclear",True,"reference-link",False,[],"Irregular","active","Link from homeopathy results.","CCRH.","")
e("nch","National Commission for Homoeopathy","homeopathy","regulator",1,"https://www.nch.org.in/nch-gazetted-rules-and-regulations","Regulations under the NCH Act 2020 (professional conduct, education).",None,"Government of India","unclear","unclear",True,"reference-link",False,["regulatory statement"],"Irregular","active","Regulatory context.","NCH.","")
e("homeoint","Homeoint / Médi-T","homeopathy","classical text transcriptions",6,"https://www.homeoint.org/medi-t/index.htm","Online transcriptions of Kent, Boericke, Clarke, Allen, etc.",None,"Site copyright on transcriptions","unclear","not-permitted",True,"reference-link",False,[],"Static","active","Reading reference only.","Private website.","Not copied, even where underlying texts are public domain.")
e("nlm-collections","NLM Digital Collections","homeopathy","historical texts",1,"https://collections.nlm.nih.gov/","Scanned historical homeopathic texts; many public domain.",None,"Per item (many public domain)","permitted","permitted-with-conditions",False,"reference-link",False,[],"Static","active","Future public-domain materia medica source (OCR required).","NLM.","Not imported in v1.")
e("nhmrc","NHMRC (Australia) — homeopathy evidence review 2015","homeopathy","evidence review",1,"https://www.nhmrc.gov.au/sites/default/files/images/nhmrc-information-paper-effectiveness-of-homeopathy.pdf","National evidence assessment.",None,"© Commonwealth of Australia (check the licence statement in the document)","unclear","unclear",True,"reference-link",False,["conclusion (paraphrase)"],"Static","active","Scientific evidence label for homeopathy.","NHMRC.","")
e("racgp","RACGP position statement on homeopathy","homeopathy","professional position",1,"https://www.racgp.org.au/","Position informed by Natural Therapies Review 2024 (published 2025).",None,"© RACGP","restricted","not-permitted",True,"reference-link",False,["position (paraphrase)"],"Periodic","active","Evidence label.","RACGP.","")
# ---------------- ayurveda ----------------
AM="Varshney S. (Amidha Ayurveda)"
e("amidha-herb-db","Amidha Ayurveda Herb Database","ayurveda","herb dataset",4,"https://github.com/sciencewithsaucee-sudo/herb-database","Herb records: botanical name, family, synonyms, part used, indications, rasa/guna/virya/vipaka/prabhava, dosha karma.",
  None,"CC BY 4.0 (v2.0.0, DOI 10.5281/zenodo.17475351)","permitted","permitted-with-conditions",True,"bundled-import",True,
  ["name","botanicalName","family","englishName","sanskritSynonyms","partUsed","mainIndications","pacifies","aggravates","rasa","guna","virya","vipaka","prabhava"],
  "Last release 2026-06-07","active","Herb properties (traditional).","Imported from GitHub release JSON; SHA-256 in manifest.","Promotional 'preview' prose and images excluded.",
  attributionText=f"{AM}, Herb Database v2.0.0, DOI 10.5281/zenodo.17475351, CC BY 4.0.",lastUpstreamUpdate="2026-06-07")
e("bhaishajya-kalpana-kosha","Bhaishajya Kalpana Kosha","ayurveda","formulation dataset",4,"https://github.com/sciencewithsaucee-sudo/Bhaishajya-Kalpana-Kosha","Classical formulations: ingredients, type, indications, reference, reported dose, anupana.",
  None,"CC BY 4.0 (v1.0.0, DOI 10.5281/zenodo.18243950)","permitted","permitted-with-conditions",True,"bundled-import",True,
  ["name","formulationType","category","ingredients","indications","classicalReference","sourceReportedDose","anupana"],"Static release","active","Formulation candidates (traditional).",
  "Imported from GitHub JSON; SHA-256 in manifest.","One duplicate ID detected in source (form_krimi_mudgar_rasa) — first record kept, reported by validator. Source-reported doses are displayed as source statements, not dosing advice.",
  attributionText=f"{AM}, Bhaishajya Kalpana Kosha v1.0.0, DOI 10.5281/zenodo.18243950, CC BY 4.0.")
e("siddhanta-kosha","Siddhanta Kosha","ayurveda","principles dataset",4,"https://github.com/sciencewithsaucee-sudo/Siddhanta-Kosha","Ayurvedic principles (dosha, agni, ama, virya…) with shloka references.",None,"CC BY 4.0 (DOI 10.5281/zenodo.17481343)","permitted","permitted-with-conditions",True,"bundled-import",True,
  ["name","category","shloka","shlokaRef","explanation","clinicalImportance"],"Static release","active","Principle layer for rationale text.","Imported from GitHub JSON.","",
  attributionText=f"{AM}, Siddhanta Kosha, DOI 10.5281/zenodo.17481343, CC BY 4.0.")
e("ayurvedic-herb-explorer","Ayurvedic Herb Explorer","ayurveda","web app",5,"https://github.com/sciencewithsaucee-sudo/ayurvedic-herb-explorer","Search/filter UI over the herb database.","MIT","Uses Amidha herb data","permitted","permitted",False,"architecture-reference",False,[],"Irregular","active","Filter UX reference.","GitHub.","")
e("ayurvedam-data","Ayurvedam-Data","ayurveda","symptom→medicine dataset",5,"https://github.com/AdityaVardhan-B/Ayurvedam-Data","Symptom-to-medicine mappings with precautions.","No licence","Unclear","unclear","not-permitted",True,"metadata-only",False,[],"Irregular","unverified","Low-confidence experimental reference; not used for candidates.","GitHub.","No licence; provenance of mappings unknown.")
for sid,name,url,lic in [("ayucare","AYUCARE","https://github.com/AbdullahShiraz/AYUCARE","No licence"),("vedassist2","VedAssist2","https://github.com/vijay-varadarajan/VedAssist2","No licence"),
  ("ai-ayurvedic-advisor","AI-Driven-Ayuvervedic-Advisor","https://github.com/anubhav811/AI-Driven-Ayuvervedic-Advisor","MIT"),("ayurvedacare-ai","AyurvedaCare_AI","https://github.com/Kalyx1111/AyurvedaCare_AI","MIT"),
  ("charak-samhita-rag","Charak_Samhita (RAG)","https://github.com/mananjp/Charak_Samhita","MIT"),("ayurproject","AyurProject","https://github.com/anupamkr1708/AyurProject","No licence")]:
    e(sid,name,"ayurveda","AI/ML implementation reference",5,url,"Ayurveda AI/case-taking/RAG implementation.",lic,"Unclear","unclear","unclear",False,"architecture-reference",False,[],"Irregular","unverified",
      "Case-taking/RAG pattern reference only.","GitHub.","Recommendations are not clinically validated; no data or model outputs used.")
e("namaste","NAMASTE (National AYUSH Morbidity & Standardized Terminologies Electronic)","ayurveda","terminology",1,"https://namaste.ayush.gov.in/","Standardised Ayurveda/Siddha/Unani terminology and morbidity codes; ICD-11 TM2 linkage.",None,"Ministry of AYUSH (download terms not verified)","unclear","unclear",True,
  "user-supplied-import",False,[],"Periodic","active","Terminology normalisation via user-supplied code file.","Ministry of AYUSH.","NAMASTE codes are not bundled or invented; the Ayurveda bridge uses approximate correlates only.")
e("arp","AYUSH Research Portal","ayurveda","research database",2,"https://arp.ayush.gov.in/","AYUSH clinical/pharmacological research metadata.",None,"Government of India","unclear","unclear",True,"reference-link",False,[],"Continuous","active","Modern-evidence lookups (link).","Ministry of AYUSH.","")
e("ccras","CCRAS","ayurveda","research council",1,"https://ccras.nic.in/","Clinical research, treatment protocols, safety guidance.",None,"Government of India","unclear","unclear",True,"reference-link",False,[],"Irregular","active","India-first Ayurveda protocol reference.","Ministry of AYUSH.","Protocol PDFs not bundled.")
e("pcimh","PCIM&H — Ayurvedic Pharmacopoeia of India (API) / Ayurvedic Formulary of India (AFI)","ayurveda","pharmacopoeia",1,"https://www.portal.pcimh.gov.in/","Official monographs and formulary standards.",None,"Government of India (copyright; sold publications)","restricted","not-permitted",True,"reference-link",False,[],"Periodic","active","Identity/quality standard reference.","PCIM&H.","Not copied.")
e("echarak","e-Charak","ayurveda","medicinal plant portal",2,"https://echarak.ayush.gov.in/knowledge_resources","Medicinal plant information and vernacular names.",None,"Terms restrict commercial use (not verified for reuse)","restricted","not-permitted",True,"reference-link",False,[],"Continuous","active","Plant name cross-check (manual).","NMPB / AYUSH.","Not copied.")

for r in R:
    assert r["redistribution"] in ("permitted","permitted-with-conditions","not-permitted","unclear"), r["id"]
ids=[r["id"] for r in R]; assert len(ids)==len(set(ids)), "dup"
os.makedirs("data",exist_ok=True)
json.dump({"generatedAt":T,"note":"Source inventory. See DATA_SOURCES.md for the human-readable table. 'level' follows the source hierarchy in ARCHITECTURE.md (1 = official/regulatory … 6 = general websites).","sources":R},open("data/source-registry.json","w"),indent=1,ensure_ascii=False)
print(len(R),"sources")
