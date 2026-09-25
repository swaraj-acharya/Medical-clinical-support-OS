/**
 * Free-text → knowledge-base concept extraction.
 *
 * Deterministic Mode (default): lexicon matching (exact → synonym/brand/variant spelling → normalised → fuzzy).
 * Optional AI mode (CDS_AI_MODE=extract): an LLM may ONLY map text to concept IDs that already exist in the knowledge
 * base. Returned IDs are validated; anything unknown is discarded. The LLM never proposes medicines, never ranks
 * candidates and never sees patient identifiers. Clinical free text is sent only if CDS_AI_ALLOW_CLINICAL_TEXT=true.
 */
import type { KnowledgeIndex } from "../knowledge/indexes";
import { resolveMedication } from "../normalize/medications";
import { scrubIdentifiers } from "../security/scrub";

export interface ExtractionResult {
  mode: "deterministic" | "deterministic+ai";
  symptoms: { conceptId: string; label: string; matchedTerm: string; matchType: string; via: "lexicon" | "ai" }[];
  medications: { input: string; drugIds: string[]; via: string; note?: string }[];
  notes: string[];
}

export { scrubIdentifiers };

export function deterministicExtract(text: string, idx: KnowledgeIndex): ExtractionResult {
  const mentions = idx.symptomLexicon.extract(text);
  const symptoms = mentions.map((m) => ({ conceptId: m.conceptId, label: idx.symptom.get(m.conceptId)?.label ?? m.conceptId, matchedTerm: m.matchedTerm, matchType: m.matchType, via: "lexicon" as const }));
  const drugMentions = idx.drugLexicon.extract(text).filter((m) => m.matchType !== "fuzzy");
  const brandHits = idx.kb.drugs.flatMap((d) => d.brandMappings.filter((b) => new RegExp(`\\b${b.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)).map((b) => b.brand));
  const medInputs = [...new Set([...brandHits, ...drugMentions.map((m) => m.matchedTerm)])];
  const medications = medInputs.map((n) => { const r = resolveMedication(n, idx); return { input: n, drugIds: r.drugIds, via: r.via, note: r.note }; });
  const notes = ["Deterministic extraction: lexicon match only. Review every suggested concept before adding it to the case."];
  if (!symptoms.length) notes.push("No known symptom term recognised — choose symptoms from the list.");
  return { mode: "deterministic", symptoms, medications, notes };
}

export async function extractConcepts(text: string, idx: KnowledgeIndex, env: NodeJS.ProcessEnv = process.env): Promise<ExtractionResult> {
  const det = deterministicExtract(text, idx);
  if (env.CDS_AI_MODE !== "extract") return det;
  if (!env.ANTHROPIC_API_KEY) return { ...det, notes: [...det.notes, "AI extraction requested but ANTHROPIC_API_KEY is not set — deterministic result only."] };
  if (env.CDS_AI_ALLOW_CLINICAL_TEXT !== "true") return { ...det, notes: [...det.notes, "AI extraction is configured but CDS_AI_ALLOW_CLINICAL_TEXT is not 'true' — clinical text was not sent. Deterministic result only."] };

  const catalogue = idx.kb.symptoms.map((s) => `${s.id}: ${s.label}`).join("\n");
  const prompt = `You map a clinician's free-text complaint to symptom concept IDs from a fixed list. Return ONLY JSON: {"conceptIds": ["sym_..."]}. Use only IDs from the list. Do not add diagnoses, medicines or advice.\n\nLIST:\n${catalogue}\n\nTEXT:\n${scrubIdentifiers(text).slice(0, 2000)}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.CDS_AI_MODEL || "claude-sonnet-5", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const txt = (data.content ?? []).map((c) => c.text ?? "").join("").replace(/```json|```/g, "").trim();
    const ids: unknown = JSON.parse(txt).conceptIds;
    const valid = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && idx.symptom.has(x)) : [];
    const discarded = Array.isArray(ids) ? ids.length - valid.length : 0;
    const have = new Set(det.symptoms.map((s) => s.conceptId));
    const extra = valid.filter((id) => !have.has(id)).map((id) => ({ conceptId: id, label: idx.symptom.get(id)!.label, matchedTerm: "(AI mapping)", matchType: "ai", via: "ai" as const }));
    return { ...det, mode: "deterministic+ai", symptoms: [...det.symptoms, ...extra], notes: [...det.notes, `AI suggested ${valid.length} known concept(s)${discarded ? `; ${discarded} unknown ID(s) discarded` : ""}. AI output is a suggestion only.`] };
  } catch (e) {
    return { ...det, notes: [...det.notes, `AI extraction failed (${e instanceof Error ? e.message : "error"}) — deterministic result only.`] };
  }
}
