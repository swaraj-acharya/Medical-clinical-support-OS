/**
 * Research-prompt builder. Pure (no Node or KB imports) so it runs in client components too.
 *
 * A PromptSpec is assembled on the server from the data a section already holds (case data, what the deterministic
 * engines found, and what is missing from the knowledge base). The clinician then chooses options in the UI and copies
 * the prompt into any LLM or deep-research tool. The app never sends these prompts anywhere itself.
 */

export type PromptKind =
  | "red-flags" | "patient-summary" | "clinical-context" | "follow-up" | "allopathy" | "ayurveda" | "homeopathy"
  | "comparison" | "conflicts" | "decisions" | "case" | "drug" | "herb" | "formulation" | "remedy" | "term"
  | "repertory" | "verification";

export interface PromptSpec {
  kind: PromptKind;
  /** Short label shown in the UI. */
  title: string;
  /** What the LLM should do, in one or two sentences. */
  objective: string;
  /** Concrete research questions, most important first. */
  questions: string[];
  /** De-identified, structured patient context (one fact per line; "## " lines are sub-headings). */
  caseData?: string[];
  /** Clinician free text, already scrubbed of identifiers. Only included when the clinician opts in. */
  caseFreeText?: string;
  /** What the decision-support tool already found (inputs the LLM should check, not trust). */
  toolFindings?: string[];
  /** What the knowledge base does not cover — the main reason to research. */
  gaps?: string[];
  /** Ready-to-run PubMed queries and plain keywords. */
  searchTerms: { pubmed: string[]; keywords: string[] };
  /** Where to look, in priority order. */
  sources: string[];
  /** Extra safety rules specific to this section. */
  safetyNotes?: string[];
  /** Required headings of the answer (between "Bottom line" and "Uncertainty / References"). */
  outputSections: string[];
  kbVersion?: string;
  /** Emergency/urgent red flag present: the prompt leads with an immediate-action instruction. */
  urgent?: "emergency" | "urgent";
  system?: "allopathy" | "ayurveda" | "homeopathy" | "integrative";
}

export type PromptDepth = "quick" | "thorough" | "systematic";

export interface PromptOptions {
  depth: PromptDepth;
  includeCase: boolean;
  includeFindings: boolean;
  includeFreeText: boolean;
  jurisdiction: "india" | "international";
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = { depth: "thorough", includeCase: true, includeFindings: true, includeFreeText: false, jurisdiction: "india" };

export const DEPTH_LABEL: Record<PromptDepth, string> = {
  quick: "Quick answer",
  thorough: "Thorough, with research papers",
  systematic: "Structured evidence review",
};

// ------------------------------------------------------------------ search helpers

const q = (t: string) => `"${t.replace(/"/g, "").trim()}"[tiab]`;

/**
 * Builds a PubMed query: each inner array is an OR-group, groups are ANDed.
 * filter: "sr" systematic reviews/meta-analyses, "rct" randomised trials, "guideline" practice guidelines.
 */
export function pubmedQuery(groups: string[][], filter: "sr" | "rct" | "sr+rct" | "guideline" | "none" = "sr", sinceYear?: number): string {
  const parts = groups.map((g) => [...new Set(g.map((x) => x.trim()).filter(Boolean))]).filter((g) => g.length).map((g) => (g.length === 1 ? q(g[0]) : `(${g.map(q).join(" OR ")})`));
  if (!parts.length) return "";
  const f = {
    sr: "(systematic review[pt] OR meta-analysis[pt])",
    rct: "randomized controlled trial[pt]",
    "sr+rct": "(systematic review[pt] OR meta-analysis[pt] OR randomized controlled trial[pt])",
    guideline: "(guideline[pt] OR practice guideline[pt])",
    none: "",
  }[filter];
  const since = sinceYear ? `("${sinceYear}"[dp] : "3000"[dp])` : "";
  return [...parts, f, since].filter(Boolean).join(" AND ");
}

// ------------------------------------------------------------------ source lists (reused by the spec builders)

export const SOURCES = {
  indiaGuidelines: "Indian guidance first: ICMR Standard Treatment Workflows, MoHFW/NHM Standard Treatment Guidelines, National List of Essential Medicines (NLEM 2022), National Formulary of India, national programme guidelines (e.g., NCVBDC for dengue/malaria), and relevant Indian specialty-society guidance",
  intlGuidelines: "International guidance: WHO, NICE guidelines and CKS, SIGN, and major specialty-society guidelines — state the year and whether they apply to Indian practice",
  evidence: "Research papers: Cochrane Library (systematic reviews), PubMed/MEDLINE and Europe PMC (systematic reviews, meta-analyses, RCTs, large cohort studies), trial registries (CTRI, ClinicalTrials.gov) for ongoing or unpublished trials",
  labels: "Official product information: CDSCO approvals and package inserts, DailyMed / openFDA structured product labels, EMC SmPCs; safety communications from PvPI (India), FDA, EMA and MHRA",
  drugSafety: "Medicine-safety references: LactMed (breastfeeding), LiverTox (hepatotoxicity), renal dose-adjustment guidance (e.g., KDIGO, product labels), published interaction studies",
  ayurvedaClassical: "Classical Ayurvedic texts (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya, Bhavaprakasha, Bhaishajya Ratnavali, Sharngadhara Samhita) — cite text, section/chapter and verse where possible",
  ayurvedaOfficial: "Official Ayurvedic standards and research: Ayurvedic Pharmacopoeia of India (API), Ayurvedic Formulary of India (AFI), CCRAS publications and clinical-research protocols, AYUSH Research Portal, NAMASTE portal (standard terminology codes)",
  herbSafety: "Herbal safety: LiverTox, NIH Office of Dietary Supplements / NCCIH, published case reports and case series of hepatotoxicity or heavy-metal toxicity, herb–drug interaction studies",
  homeoMM: "Homeopathic materia medica and repertories (Boericke, Clarke's Dictionary, Allen's Keynotes, Hering's Guiding Symptoms; Kent, Synthesis, Complete Repertory), CCRH publications and the Indian Journal of Research in Homoeopathy",
  homeoEvidence: "Evidence appraisals of homeopathy: Cochrane reviews, NHMRC Information Paper (2015), independent systematic reviews and meta-analyses (report risk of bias), regulatory safety notices (e.g., FDA warnings on homeopathic products)",
  emergency: "Emergency and acute-care guidance: WHO ETAT/IMCI (children), RCEM and NICE pathways, Surviving Sepsis Campaign, NEWS2 (RCP), validation studies of clinical decision rules",
  terminology: "Terminology: ICD-11 (WHO), SNOMED CT browser, RxNorm/RxNav, WHO ATC index, NAMASTE (Ayurveda), standard homeopathic abbreviations",
};

// ------------------------------------------------------------------ prompt text

const DEPTH_METHOD: Record<PromptDepth, string[]> = {
  quick: [
    "Give a concise, practical answer for a busy clinician.",
    "Base it on the most authoritative current guideline and the most recent high-quality systematic review; 3–6 key references are enough.",
  ],
  thorough: [
    "Work through the sources below in order: guidelines first, then research papers, then regulatory and safety sources.",
    "For research papers, prefer systematic reviews and meta-analyses, then randomised controlled trials, then large observational studies. Prefer publications from the last 10 years, but include older landmark trials that still define practice.",
    "Use the suggested PubMed searches as a starting point and refine them (MeSH terms, synonyms, spelling variants). Report which searches you actually ran.",
    "Where sources disagree, show both positions and explain which is more applicable to this patient and to Indian practice.",
  ],
  systematic: [
    "Conduct a structured rapid evidence review.",
    "1) Frame the question(s) in PICO form (Population, Intervention/Exposure, Comparator, Outcomes) using the patient context.",
    "2) Search PubMed/MEDLINE, Cochrane Library (CDSR and CENTRAL), Europe PMC and trial registries (CTRI, ClinicalTrials.gov). Report the exact search strings, dates searched and the number of records screened and included.",
    "3) State inclusion/exclusion criteria (study design, population, setting, language).",
    "4) Build an evidence table: study, design, population (n), intervention/comparator, outcomes, effect size with 95% CI, risk of bias.",
    "5) Rate certainty per outcome with GRADE (high / moderate / low / very low) and explain downgrades.",
    "6) List relevant ongoing or unpublished trials.",
  ],
};

function bullets(xs: string[]): string {
  return xs.map((x) => (x.startsWith("## ") ? `\n${x.slice(3)}:` : `- ${x}`)).join("\n").replace(/^\n/, "");
}

export function buildPrompt(spec: PromptSpec, opts: PromptOptions = DEFAULT_PROMPT_OPTIONS): string {
  const out: string[] = [];
  const india = opts.jurisdiction === "india";

  out.push(
    `You are a clinical research assistant supporting a qualified, registered clinician${india ? " practising in India" : ""}. The clinician — not you — makes every diagnostic and treatment decision. Your job is to find, critically appraise and summarise the best available evidence and authoritative guidance, with citations the clinician can verify.`,
  );
  if (spec.urgent === "emergency") out.push("⚠ EMERGENCY: the decision-support tool detected an emergency red flag. Research must not delay emergency assessment or referral. Begin your answer with the immediate-action pathway (recognition, first actions, referral/transfer criteria, time-critical investigations).");
  else if (spec.urgent === "urgent") out.push("⚠ URGENT: the decision-support tool detected an urgent red flag. Begin your answer with what must be assessed or excluded before any symptomatic treatment.");

  out.push(`## Task\n${spec.objective}`);
  if (spec.questions.length) out.push(`## Questions to answer\n${spec.questions.map((x, i) => `${i + 1}. ${x}`).join("\n")}`);

  if (opts.includeCase && spec.caseData?.length) {
    out.push(`## Patient context (de-identified)\n${bullets(spec.caseData)}\n(Direct identifiers have been removed. Do not attempt to identify the patient.)`);
  }
  if (opts.includeCase && opts.includeFreeText && spec.caseFreeText) {
    out.push(`## Clinician's notes (identifiers scrubbed automatically)\n"""\n${spec.caseFreeText}\n"""`);
  }
  if (opts.includeFindings && spec.toolFindings?.length) {
    out.push(`## What the decision-support tool already found${spec.kbVersion ? ` (knowledge base v${spec.kbVersion})` : ""}\nThese come from deterministic rules over a curated knowledge base. Treat them as a starting point to check, not as verified facts.\n${bullets(spec.toolFindings)}`);
  }
  if (spec.gaps?.length) out.push(`## Gaps — not covered by the tool's knowledge base\nThese are the main reasons for this research. Address each one.\n${bullets(spec.gaps)}`);

  const method = [...DEPTH_METHOD[opts.depth]];
  out.push(`## How to research\n${method.map((m) => (/^\d\)/.test(m) ? m : `- ${m}`)).join("\n")}`);
  const src = spec.sources.map((s) => (india ? s : s.replace(/^Indian guidance first: /, "Indian guidance (where relevant): ")));
  out.push(`Sources, in priority order:\n${src.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  const pm = spec.searchTerms.pubmed.filter(Boolean);
  if (pm.length && opts.depth !== "quick") out.push(`Suggested PubMed searches (adapt as needed):\n${pm.map((p) => `- ${p}`).join("\n")}`);
  if (spec.searchTerms.keywords.length) out.push(`Keywords and synonyms to include: ${[...new Set(spec.searchTerms.keywords)].join("; ")}`);

  const rules = [
    "Cite every clinical claim with a verifiable identifier: PMID or DOI for papers; issuing body, title, year and URL for guidelines and labels. Never invent references, authors, PMIDs, DOIs or URLs. If you cannot verify a source, write \"unverified\" next to it.",
    "If you cannot browse the internet, say so at the start and mark every claim that relies on training data as \"from memory — verify\". State the date your knowledge ends.",
    india
      ? "Prefer Indian sources (ICMR, MoHFW, NLEM, CDSCO, PvPI, National Formulary of India) and say explicitly when you rely on international sources instead. Mention availability in India where relevant."
      : "Use international guidance; note Indian differences where you know them.",
    "Label the type of evidence for each point: guideline recommendation, systematic review/meta-analysis, RCT, observational study, case report, expert opinion, or traditional/classical text. Give GRADE certainty where possible.",
    "Do not give doses unless you quote them from a cited label, formulary or guideline — and mark them \"verify against the current label\". Consider age, weight, renal and hepatic function.",
    "Check every option against this patient's factors: age, sex, pregnancy/breastfeeding, renal and hepatic function, allergies, current medicines and chronic conditions. Flag interactions and contraindications.",
    "Point out any red-flag feature that needs urgent assessment, even if not asked.",
    "Keep traditional/classical rationale (Ayurveda, homeopathy) separate from modern clinical evidence. Traditional use or legal recognition is not evidence of efficacy.",
    ...(spec.safetyNotes ?? []),
    "Write for the clinician, not the patient. Be precise about uncertainty; do not overstate weak evidence.",
  ];
  out.push(`## Rules\n${rules.map((r) => `- ${r}`).join("\n")}`);

  const heads = [
    "Bottom line (at most 5 sentences, with the overall certainty of evidence)",
    ...spec.outputSections,
    "Patient-specific safety considerations",
    "What remains uncertain, and what the clinician should verify",
    "References (numbered, Vancouver style, each with PMID/DOI/URL and year)",
  ];
  const tableHint = opts.depth === "quick" ? "Keep it short; use a table only where it saves space." : "Use tables where they help (e.g., option | key evidence | certainty | patient-specific caution | reference numbers).";
  out.push(`## Answer format\nUse these headings, in this order:\n${heads.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n${tableHint}`);

  return out.join("\n\n");
}
