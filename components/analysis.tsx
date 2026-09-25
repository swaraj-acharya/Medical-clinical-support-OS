import Link from "next/link";
import type { ReactNode } from "react";
import type { Advisory, AllopathyCandidate, AyurvedaCandidate, Candidate, HomeopathyCandidate, SafetyFinding, SystemResult } from "@/types/recommendation";
import type { CaseRecord } from "@/lib/storage/cases";
import { DecisionControl } from "./decision";
import { SourceList } from "./sources";
import { LEVEL_LABEL, LEVEL_TONE, SafetyStatusTag, SYSTEM_LABEL, Tag } from "./ui";

const EVIDENCE_LABEL: Record<string, string> = {
  "authoritative-guideline": "Authoritative guideline", "clinical-evidence": "Clinical evidence", "research-evidence": "Research evidence",
  "traditional-classical": "Traditional / classical reference", "repertory-reference": "Repertory reference", "limited-evidence": "Limited evidence",
  "conflicting-evidence": "Conflicting evidence", "insufficient-evidence": "Insufficient evidence",
};

export function Findings({ findings }: { findings: SafetyFinding[] }) {
  if (!findings.length) return null;
  return (
    <ul className="space-y-2">
      {findings.map((f) => (
        <li key={f.id} className="text-sm">
          <div className="flex flex-wrap items-baseline gap-2"><Tag tone={LEVEL_TONE[f.level]}>{LEVEL_LABEL[f.level]}</Tag><span className="font-medium">{f.title}</span></div>
          <p className="mt-0.5 text-ink-soft">{f.detail}</p>
          {f.matchedFacts && f.matchedFacts.length > 0 && <p className="text-xs text-ink-soft">Matched: {f.matchedFacts.join("; ")}</p>}
          <SourceList sources={f.sources} compact />
        </li>
      ))}
    </ul>
  );
}

function Advisories({ items }: { items: Advisory[] }) {
  if (!items.length) return null;
  const tone = (k: Advisory["kind"]) => (k === "alarm" ? "danger" : k === "do-not-offer" ? "caution" : "neutral");
  const label = { alarm: "Alarm feature", "do-not-offer": "Guideline: do not offer", note: "Note", evidence: "Evidence", regulatory: "Regulatory" } as const;
  return (
    <ul className="mb-4 space-y-2">
      {items.map((a, i) => (
        <li key={i} className="text-sm"><Tag tone={tone(a.kind)}>{label[a.kind]}</Tag> <span>{a.text}</span><SourceList sources={a.sources} compact /></li>
      ))}
    </ul>
  );
}

function Metric({ c }: { c: Candidate }) {
  if (c.system === "allopathy") {
    const m = (c as AllopathyCandidate).metric;
    return <p className="text-sm"><span className="text-ink-soft">{m.label}:</span> {m.contextLabel} — {m.contextFeaturesMatched.length}/{m.contextFeaturesTotal} features; guideline says <strong>{m.recommendationKind === "offer" ? "offer" : "consider"}</strong></p>;
  }
  if (c.system === "ayurveda") {
    const m = (c as AyurvedaCandidate).metric;
    return <p className="text-sm"><span className="text-ink-soft">{m.label}:</span> {m.matchedTerms.join(", ")}{m.doshaSupport.length ? ` · ${m.doshaSupport.length} dosha support note(s)` : ""}{m.doshaCautions.length ? ` · ${m.doshaCautions.length} caution(s)` : ""}</p>;
  }
  const m = (c as HomeopathyCandidate).metric;
  return <p className="text-sm"><span className="text-ink-soft">{m.label}:</span> <span className="num">{m.rubricsCovered}/{m.rubricsSelected}</span> rubrics covered · grade sum <span className="num">{m.gradeSum}</span> · weighted <span className="num">{m.weightedScore}</span> <span className="text-ink-soft">({m.repertory})</span></p>;
}

export function CandidateBlock({ c, caseRec, analysisId }: { c: Candidate; caseRec: CaseRecord; analysisId: string }) {
  const decisions = caseRec.decisions.filter((d) => d.analysisId === analysisId && d.candidateId === c.id);
  const abbrev = c.system === "homeopathy" ? ` (${(c as HomeopathyCandidate).abbrev})` : c.system === "ayurveda" ? ` — ${(c as AyurvedaCandidate).kind}` : "";
  return (
    <article className="border-t border-hairline py-4 first:border-t-0 first:pt-0">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3><Link href={`/medicines/${c.entityId}`}>{c.name}</Link><span className="font-sans text-sm font-normal text-ink-soft">{abbrev}</span></h3>
        <SafetyStatusTag status={c.safetyStatus} />
        <span className="ml-auto text-xs text-ink-soft">Candidate for clinician review · last verified {c.lastVerified}</span>
      </header>
      <Metric c={c} />
      {c.system === "allopathy" && <p className="mt-1 text-sm text-ink-soft">{(c as AllopathyCandidate).guidelineStatement}</p>}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-allo">Why this was surfaced, safety findings and sources</summary>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium">Surfaced because</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{c.surfacedBecause.map((w, i) => <li key={i}>{w.text}<SourceList sources={w.sources} compact /></li>)}</ul>
            <h4 className="mt-3 text-sm font-medium">Evidence labels</h4>
            <ul className="mt-1 space-y-1 text-sm">{c.evidence.map((e, i) => <li key={i}><Tag>{EVIDENCE_LABEL[e.category] ?? e.category}</Tag> {e.summary}</li>)}</ul>
          </div>
          <div>
            <h4 className="text-sm font-medium">Safety findings</h4>
            {c.safety.length ? <Findings findings={c.safety} /> : <p className="text-sm text-ink-soft">No conflict found in the data entered (allergies, conditions, medicines, pregnancy). Missing data limits this check.</p>}
            <h4 className="mt-3 text-sm font-medium">Sources</h4>
            <SourceList sources={c.sources} />
          </div>
        </div>
        {c.system === "homeopathy" && (
          <div className="mt-3 overflow-x-auto">
            <table className="text-sm"><tbody>{(c as HomeopathyCandidate).rubricGrades.map((g) => <tr key={g.rubricId}><td className="pr-3 text-ink-soft">{g.path}</td><td className="num">{g.grade ? `grade ${g.grade}` : "—"}</td></tr>)}</tbody></table>
          </div>
        )}
      </details>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <DecisionControl caseId={caseRec.id} analysisId={analysisId} candidateId={c.id} system={c.system} candidateName={c.name} />
        {decisions.map((d) => <span key={d.id} className="text-sm"><Tag tone="allo">{d.action}</Tag> by {d.clinicianRef}{d.reason ? ` — “${d.reason}”` : ""}</span>)}
      </div>
    </article>
  );
}

export function SystemLane({ r, caseRec, analysisId, extra }: { r: SystemResult<Candidate>; caseRec: CaseRecord; analysisId: string; extra?: ReactNode }) {
  return (
    <div>
      <p className="prose-measure text-sm text-ink-soft"><strong className="text-ink">Method.</strong> {r.methodology}</p>
      <p className="prose-measure mt-1 text-sm text-ink-soft"><strong className="text-ink">Evidence framing.</strong> {r.evidenceFraming}</p>
      <div className="mt-4"><Advisories items={r.advisories} /></div>
      {extra}
      {r.notFound.map((n, i) => <p key={i} className="mb-3 rounded-[3px] bg-wash px-3 py-2 text-sm">{n}</p>)}
      {r.candidates.length > 0 && (
        <div className="mt-2">
          <h3 className="mb-3 text-base">{SYSTEM_LABEL[r.system]} candidates — suggested for clinician review <span className="font-sans text-sm font-normal text-ink-soft">({r.candidates.length})</span></h3>
          {r.candidates.map((c) => <CandidateBlock key={c.id} c={c} caseRec={caseRec} analysisId={analysisId} />)}
        </div>
      )}
      {r.excluded.length > 0 && (
        <div className="mt-4 rounded-[3px] border border-danger/30 bg-danger-wash/40 px-4 py-3">
          <h3 className="text-base">Excluded by safety checks ({r.excluded.length})</h3>
          <ul className="mt-2 space-y-1.5 text-sm">{r.excluded.map((e) => <li key={e.entityId}><Link href={`/medicines/${e.entityId}`} className="font-medium">{e.name}</Link> — {e.reason}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
