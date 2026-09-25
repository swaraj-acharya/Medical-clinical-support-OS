import type { AllopathyCandidate, ContextMatch, EvidenceLabel, SystemResult, WhyItem } from "../../types/recommendation";
import type { KnowledgeIndex } from "../knowledge/indexes";
import { checkDrugSafety } from "../safety/medication";
import type { PatientState } from "../safety/patient-state";

export const ALLOPATHY_METHOD =
  "Guideline / clinical-context matching: the case is compared with curated feature sets (e.g., ICHD-3 migraine features); guideline recommendations attached to matching contexts yield candidate medicines, which are then filtered by allergy, contraindication, interaction, duplicate-therapy and pregnancy rules. No machine-learning classifier and no dosing.";

export const ALLOPATHY_FRAMING =
  "Evidence labels refer to the cited guideline or label. Most drug facts in this build are hand-curated seeds marked 'pending verification' — confirm against the current label/formulary.";

function latest(dates: (string | undefined)[]) {
  return dates.filter(Boolean).sort().at(-1) ?? "unknown";
}

export function runAllopathy(st: PatientState, idx: KnowledgeIndex, contexts: ContextMatch[]): SystemResult<AllopathyCandidate> {
  const result: SystemResult<AllopathyCandidate> = { system: "allopathy", methodology: ALLOPATHY_METHOD, evidenceFraming: ALLOPATHY_FRAMING, candidates: [], excluded: [], advisories: [], notFound: [] };
  const qualifying = contexts.filter((c) => c.qualifies);
  if (!qualifying.length) {
    const scope = idx.kb.conditions.map((c) => c.label).join("; ");
    result.notFound.push(`No curated clinical context matched the entered findings. This build covers: ${scope}. Absence of a candidate is not a clinical judgement.`);
    return result;
  }
  const best = new Map<string, AllopathyCandidate & { _rank: number }>();
  const excludedSeen = new Set<string>();
  for (const ctx of qualifying) {
    for (const a of ctx.alarms) result.advisories.push({ kind: "alarm", text: `${ctx.label}: ${a.text}`, sources: a.sources });
    for (const rec of idx.recsByContext.get(ctx.contextId) ?? []) {
      const gl = idx.guideline.get(rec.guidelineId);
      if (rec.kind === "do-not-offer") {
        result.advisories.push({ kind: "do-not-offer", text: rec.statement, sources: rec.sources });
        continue;
      }
      for (const drugId of rec.drugIds) {
        const d = idx.drug.get(drugId);
        if (!d) continue;
        if (ctx.alarms.length) {
          const key = `${drugId}:alarm`;
          if (!excludedSeen.has(key)) { excludedSeen.add(key); result.excluded.push({ name: d.name, entityId: d.id, reason: `Alarm feature present for ${ctx.label} — investigation/referral before empirical therapy.` }); }
          continue;
        }
        const safety = checkDrugSafety(d, st, idx);
        if (safety.status === "excluded") {
          if (!excludedSeen.has(drugId)) { excludedSeen.add(drugId); result.excluded.push({ name: d.name, entityId: d.id, reason: safety.exclusionReasons.join(" · ") }); }
          continue;
        }
        const rank = (rec.kind === "offer" ? 2 : 1) * 10 + ctx.score * 5 - (safety.status === "caution" ? 3 : 0);
        const prev = best.get(drugId);
        if (prev && prev._rank >= rank) continue;
        const why: WhyItem[] = [
          { kind: "context", text: `${ctx.label}: ${ctx.matched.length}/${ctx.total} features present (${ctx.matched.join(", ")})`, sources: ctx.sources },
          { kind: "guideline", text: `${rec.kind === "offer" ? "Guideline recommends (offer)" : "Guideline suggests considering"}: ${rec.statement}`, sources: rec.sources },
        ];
        if (safety.status === "no-conflict-in-entered-data") why.push({ kind: "safety-ok", text: "No allergy, contraindication, interaction or duplication conflict found in the entered data." });
        else why.push({ kind: "safety-caution", text: `${safety.findings.filter((f) => f.level !== "info").length} caution(s) — review before use.` });
        const evidence: EvidenceLabel[] = [{ category: "authoritative-guideline", summary: gl ? `${gl.issuer}: ${gl.title} (${gl.version})` : rec.guidelineId, source: rec.sources[0] }];
        if (safety.findings.some((f) => /conflicting/i.test(f.detail))) evidence.push({ category: "conflicting-evidence", summary: "Interaction evidence is conflicting (see safety findings)." });
        if (d.verification === "curated-pending-verification") why.push({ kind: "source", text: "Drug facts are curated seeds pending verification against the current label." });
        best.set(drugId, {
          _rank: rank,
          id: `allo:${drugId}`,
          system: "allopathy",
          entityId: drugId,
          name: d.name,
          surfacedBecause: why,
          safety: safety.findings,
          safetyStatus: safety.status,
          evidence,
          sources: [...rec.sources, ...d.sources],
          lastVerified: latest(d.sources.map((s) => s.lastVerified)),
          metric: { label: "Guideline / clinical context match", contextId: ctx.contextId, contextLabel: ctx.label, contextFeaturesMatched: ctx.matched, contextFeaturesTotal: ctx.total, recommendationKind: rec.kind },
          guidelineStatement: rec.statement,
        });
      }
    }
  }
  // A drug excluded in one context but surfaced in another stays excluded (safety wins).
  const safetyExcluded = new Set([...excludedSeen].filter((k) => !k.endsWith(":alarm")));
  result.candidates = [...best.values()].filter((c) => !safetyExcluded.has(c.entityId)).sort((a, b) => b._rank - a._rank).map(({ _rank, ...c }) => c);
  const seenAdv = new Set<string>();
  result.advisories = result.advisories.filter((a) => (seenAdv.has(a.text) ? false : (seenAdv.add(a.text), true)));
  return result;
}
