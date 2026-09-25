import Link from "next/link";
import { notFound } from "next/navigation";
import { Findings, SystemLane } from "@/components/analysis";
import { AcknowledgeForm } from "@/components/decision";
import { SourceList } from "@/components/sources";
import { KV, Section, SafetyStatusTag, SYSTEM_LABEL, Tag } from "@/components/ui";
import { SectionTools } from "@/components/section-tools";
import { INFO } from "@/lib/content/section-info";
import { buildIndex } from "@/lib/knowledge/indexes";
import { getKnowledge, getRegistry } from "@/lib/knowledge/store";
import { analysisSpecs } from "@/lib/prompts/specs";
import { getAnalysis, getCase, type CaseRecord } from "@/lib/storage/cases";
import type { AnalysisResult, Candidate, SystemResult } from "@/types/recommendation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analysis" };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let a: AnalysisResult; let c: CaseRecord;
  try { a = getAnalysis(id); c = getCase(a.caseId); } catch { notFound(); }
  const p = c.input.patient;
  const rf = a.redFlags;
  const reg = new Map(getRegistry().map((s) => [s.id, s]));
  const systems = (["allopathy", "ayurveda", "homeopathy"] as const).filter((s) => c.input.systems.includes(s));
  const lanes = systems.map((s) => [s, a[s] as SystemResult<Candidate> | undefined] as const);
  const gate = rf.status === "emergency" ? { cls: "border-danger bg-danger-wash", title: "Emergency red flag — candidate generation blocked", tone: "text-danger" }
    : rf.status === "urgent" ? { cls: "border-caution bg-caution-wash", title: a.candidatesWithheld ? "Urgent red flag — candidates withheld until assessed" : "Urgent red flag — assessed by clinician, candidates shown", tone: "text-[#7a4f10]" }
    : { cls: "border-ok bg-ok-wash", title: "No red-flag rule matched the entered data", tone: "text-ok" };
  const qualifying = a.contexts.filter((x) => x.qualifies);
  const specs = analysisSpecs(a, c.input, buildIndex(getKnowledge()), c.decisions.filter((d) => d.analysisId === a.analysisId));

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-soft"><Link href={`/cases/${c.id}`}>Case {p.patientRef}</Link> · analysis {a.analysisId}</p>
          <h1>Analysis for {p.patientRef}</h1>
          <p className="text-sm text-ink-soft">{a.createdAt.slice(0, 19).replace("T", " ")} UTC · knowledge base v{a.knowledgeBaseVersion} (#{a.knowledgeContentHash.slice(0, 10)}) · {a.mode === "deterministic" ? "Deterministic Mode" : "Deterministic Mode with AI-assisted extraction"}</p>
        </div>
      </header>

      <section aria-labelledby="gate" className={`mb-6 border-l-[6px] px-5 py-4 ${gate.cls}`}>
        <h2 id="gate" className={gate.tone}>{gate.title}</h2>
        <p className="mt-1 text-sm">{a.withheldReason ?? (a.acknowledgement ? "A clinician has recorded an assessment of the urgent red flag(s) below; candidates are shown. The findings remain part of this record." : rf.note)}</p>
        <p className="mt-1 text-xs text-ink-soft">{rf.checkedRuleCount} red-flag rules checked{rf.missingVitals?.length ? `; not fully evaluable because these vitals were not recorded: ${rf.missingVitals.join(", ")}` : ""}.</p>
        {rf.findings.length > 0 && <div className="mt-3"><Findings findings={rf.findings} /></div>}
        {a.acknowledgement && <p className="mt-3 text-sm">Assessed by <strong>{a.acknowledgement.clinicianRef}</strong> at {a.acknowledgement.at.slice(0, 16).replace("T", " ")}: “{a.acknowledgement.reason}”</p>}
        <SectionTools info={INFO.analysisGate} prompt={specs.redFlags} promptLabel={rf.status === "clear" ? "Research prompt: serious causes to exclude" : "Research prompt: red-flag pathway"} className="mt-4" />
        {rf.status === "urgent" && a.candidatesWithheld && <AcknowledgeForm caseId={c.id} rules={rf.findings.map((f) => ({ id: f.ruleId!, title: f.title }))} />}
      </section>

      <Section title="Patient summary" info={INFO.patientSummary} prompt={specs.patientSummary} promptLabel={a.medicationNormalization.some((m) => m.via === "unrecognised" || m.via === "fuzzy") ? "Research prompt: identify unrecognised medicines" : "Research prompt: medication safety review"} summary={`${p.ageYears} y · ${p.sex}${a.patientTags.length ? ` · ${a.patientTags.filter((t) => !t.startsWith("on:") && !t.startsWith("allergy:")).length} safety tags` : ""}`}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <KV items={[
              ["Symptoms (normalised)", a.normalizedSymptoms.map((s) => `${s.label}${s.role === "chief" ? " (chief)" : s.role === "associated" ? " (assoc.)" : ""}`).join(", ")],
              ["Allergies", a.allergyNormalization.length ? a.allergyNormalization.map((x) => `${x.substance}${x.recognised ? "" : " (not recognised)"}`).join(", ") : "none entered"],
              ["Medicines", a.medicationNormalization.length ? a.medicationNormalization.map((m) => `${m.input} → ${m.drugIds.length ? m.drugIds.map((d) => d.replace("drug_", "")).join(" + ") : m.classTags.length ? `class ${m.classTags.join(", ")}` : "not recognised"} [${m.via}]`).join("; ") : "none entered"],
            ]} />
            {a.medicationNormalization.some((m) => m.note) && <ul className="mt-2 list-disc pl-5 text-xs text-ink-soft">{a.medicationNormalization.filter((m) => m.note).map((m) => <li key={m.input}>{m.note}</li>)}</ul>}
          </div>
          <div>
            <h3 className="text-sm font-medium">Patient-state tags used by the safety rules</h3>
            {a.patientTagDerivations.length ? <ul className="mt-1 list-disc pl-5 text-sm">{a.patientTagDerivations.map((d) => <li key={d}>{d}</li>)}</ul> : <p className="text-sm text-ink-soft">No age, pregnancy, organ-function or condition tags derived.</p>}
          </div>
        </div>
        {a.regimenReview.length > 0 && <div className="mt-4"><h3 className="mb-2 text-sm font-medium">Current regimen review (before any new medicine)</h3><Findings findings={a.regimenReview} /></div>}
      </Section>

      <Section title="Clinical context" info={INFO.clinicalContext} prompt={specs.clinicalContext} promptLabel={qualifying.length ? "Research prompt: diagnosis and differential" : "Research prompt: condition not in knowledge base"} summary={qualifying.length ? `${qualifying.length} context(s) met` : "no curated context met"}>
        {a.contexts.length === 0 ? <p className="text-sm text-ink-soft">No curated clinical context applies to the entered symptoms.</p> : (
          <div className="space-y-4">
            {a.contexts.map((x) => (
              <div key={x.contextId}>
                <div className="flex flex-wrap items-baseline gap-2"><h3 className="text-base">{x.label}</h3>{x.qualifies ? <Tag tone="allo">Criteria met ({x.matched.length}/{x.total}, minimum {x.minimumFeatures})</Tag> : <Tag>Not met ({x.matched.length}/{x.total}, minimum {x.minimumFeatures})</Tag>}<span className="text-xs text-ink-soft">Context fit {Math.round(x.score * 100)}% of weighted features — not a probability of disease</span></div>
                <p className="prose-measure text-sm text-ink-soft">{x.description}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5 text-xs">{x.features.map((f) => <li key={f.id}><Tag tone={f.status === "met" ? "ok" : f.status === "unknown" ? "neutral" : "neutral"}>{f.status === "met" ? "✓" : f.status === "unknown" ? "?" : "✗"} {f.label}</Tag></li>)}</ul>
                {x.alarms.map((al) => <p key={al.id} className="mt-2 text-sm text-danger">Alarm feature: {al.text}</p>)}
                {x.codes.length > 0 && <p className="mt-1 text-xs text-ink-soft">{x.codes.map((cd) => `${cd.system} ${cd.code ?? "—"}${cd.display ? ` ${cd.display}` : ""}`).join(" · ")} (codes pending verification)</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Follow-up questions" info={INFO.followUp} prompt={specs.followUp} summary={`${a.followUp.filter((q) => q.priority === "high").length} high priority`}>
        {a.followUp.length === 0 ? <p className="text-sm text-ink-soft">No gaps detected in the entered data.</p> : (
          <ol className="space-y-2 text-sm">
            {a.followUp.map((q) => <li key={q.id} className="flex gap-3"><span className="w-16 shrink-0"><Tag tone={q.priority === "high" ? "danger" : q.priority === "medium" ? "caution" : "neutral"}>{q.priority}</Tag></span><span><span className="font-medium">{q.question}</span><br /><span className="text-ink-soft">{q.reason}</span></span></li>)}
          </ol>
        )}
      </Section>

      {a.candidatesWithheld ? (
        <p className="mb-4 rounded-[3px] border border-hairline bg-panel px-5 py-4 text-sm">System results are not shown while red-flag screening withholds candidates. The red-flag research prompt above covers the recommended pathway.</p>
      ) : lanes.map(([s, r]) => r && (
        <Section key={s} id={s} title={SYSTEM_LABEL[s]} lane={s} info={INFO[s]} prompt={specs[s]} promptLabel={`Research prompt: ${SYSTEM_LABEL[s]}${r.notFound.length ? " (options not in knowledge base)" : ""}`} summary={`${r.candidates.length} candidate(s)${r.excluded.length ? ` · ${r.excluded.length} excluded` : ""}`}>
          <SystemLane r={r} caseRec={c} analysisId={a.analysisId} extra={s === "homeopathy" && r.rubricsUsed?.length ? (
            <div className="mb-4">
              <h3 className="text-base">Rubrics repertorized</h3>
              <ul className="mt-1 space-y-0.5 text-sm">{r.rubricsUsed.map((u) => <li key={u.rubricId}>{u.path} <span className="text-ink-soft">×{u.weight} · {u.remedyCount} remedies · {u.origin === "auto-suggested" ? `auto-suggested (${u.reason})` : "clinician-selected"}</span></li>)}</ul>
              <p className="mt-1 text-xs"><Link href="/repertory">Refine rubrics in the repertory selector</Link></p>
            </div>
          ) : undefined} />
        </Section>
      ))}

      {!a.candidatesWithheld && lanes.length > 1 && (
        <Section title="Side-by-side comparison" info={INFO.comparison} prompt={specs.comparison} summary="each system uses its own method — scores are not comparable">
          <div className="grid gap-4 lg:grid-cols-3">
            {lanes.map(([s, r]) => r && (
              <div key={s} className={`lane lane-${s} pl-4`}>
                <h3 className="text-base">{SYSTEM_LABEL[s]}</h3>
                <p className="text-xs text-ink-soft">{s === "allopathy" ? "Guideline / clinical context match" : s === "ayurveda" ? "Ayurvedic context match (traditional rationale)" : "Repertory match (coverage and grades)"}</p>
                <ol className="mt-2 space-y-1 text-sm">{r.candidates.slice(0, 5).map((cd) => <li key={cd.id} className="flex items-baseline gap-2"><Link href={`/medicines/${cd.entityId}`}>{cd.name}</Link><SafetyStatusTag status={cd.safetyStatus} /></li>)}</ol>
                {!r.candidates.length && <p className="text-sm text-ink-soft">No candidates.</p>}
                <p className="mt-2 text-xs text-ink-soft">{r.excluded.length} excluded by safety checks</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Conflicts and sources" info={INFO.conflicts} prompt={specs.conflicts} summary={`${a.sourcesUsed.length} sources cited`} open={a.conflicts.length > 0}>
        {a.conflicts.length > 0 && (
          <div className="mb-4">
            <h3 className="text-base">Conflicting information detected</h3>
            <ul className="mt-2 space-y-3 text-sm">{a.conflicts.map((cf, i) => <li key={i}><span className="font-medium">{cf.topic}</span><p className="text-ink-soft">{cf.detail}</p><SourceList sources={cf.sources} compact /></li>)}</ul>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="text-left text-ink-soft"><tr><th className="py-1 font-medium">Source</th><th className="font-medium">Level</th><th className="font-medium">Licence</th><th className="font-medium">How used</th></tr></thead>
          <tbody>{a.sourcesUsed.map((sid) => { const s = reg.get(sid); return <tr key={sid} className="border-t border-hairline"><td className="py-1"><Link href={`/sources#${sid}`}>{s?.name ?? sid}</Link></td><td className="num">{s?.level ?? "—"}</td><td>{s?.dataLicense ?? "—"}</td><td>{s?.integration ?? "—"}</td></tr>; })}</tbody>
        </table>
      </Section>

      <Section title="Clinician decision record" info={INFO.decisions} prompt={specs.decisions} promptLabel="Research prompt: appraise the plan" summary={`${c.decisions.filter((d) => d.analysisId === a.analysisId).length} decision(s) on this analysis`}>
        <p className="text-sm text-ink-soft">Record a decision on each candidate above (review, accept, modify, reject or choose an alternative). Every decision is stored with this analysis ID, the knowledge-base version and a hash-chained audit entry.</p>
        <ul className="mt-3 space-y-1 text-sm">{c.decisions.filter((d) => d.analysisId === a.analysisId).map((d) => <li key={d.id}><Tag tone="allo">{d.action}</Tag> {d.candidateName} — {d.clinicianRef}{d.alternative ? ` → ${d.alternative}` : ""}{d.reason ? `: “${d.reason}”` : ""}</li>)}</ul>
      </Section>
    </div>
  );
}
