import Link from "next/link";
import { notFound } from "next/navigation";
import { RunAnalysisButton } from "@/components/actions";
import { BlockHeader, KV, PageHeader, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { buildIndex } from "@/lib/knowledge/indexes";
import { caseSpec } from "@/lib/prompts/specs";
import { getAnalysis } from "@/lib/storage/cases";
import { getKnowledge } from "@/lib/knowledge/store";
import { readAudit, verifyAuditChain } from "@/lib/storage/audit";
import { getCase, type CaseRecord } from "@/lib/storage/cases";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let c: CaseRecord;
  try { c = getCase(id); } catch { notFound(); }
  const kb = getKnowledge();
  const sym = new Map(kb.symptoms.map((s) => [s.id, s.label]));
  const cond = new Map(kb.historyConditions.map((h) => [h.id, h.label]));
  const audit = readAudit({ caseId: id });
  const chain = verifyAuditChain();
  const p = c.input.patient;
  const latest = c.analyses.at(-1);
  let latestAnalysis;
  try { latestAnalysis = latest ? getAnalysis(latest.analysisId) : undefined; } catch { latestAnalysis = undefined; }
  const prompt = caseSpec(c.input, buildIndex(kb), latestAnalysis);
  return (
    <div>
      <PageHeader title={`Case ${p.patientRef}`} info={INFO.caseDetail} prompt={prompt} promptLabel="Research prompt: full case brief" lead={<>{p.ageYears} years, {p.sex}{p.pregnancyStatus === "pregnant" ? `, pregnant (${p.gestationalWeeks ?? "?"} weeks)` : ""}. Created {c.createdAt.slice(0, 16).replace("T", " ")}.</>}
        actions={<>{latest && <Link className="self-center text-sm" href={`/analysis/${latest.analysisId}`}>Open latest analysis</Link>}<RunAnalysisButton caseId={c.id} label={latest ? "Re-run analysis" : "Run analysis"} /><a className="self-center text-sm" href={`/api/cases/${c.id}/fhir`}>Export FHIR bundle</a></>} />
      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <BlockHeader title="Case data" info={INFO.caseData} />
          <KV items={[
            ["Chief complaint", sym.get(c.input.complaint.chiefComplaintId)],
            ["Presenting", c.input.complaint.symptoms.map((s) => `${sym.get(s.conceptId)}${[s.laterality, s.sensation, s.severity, s.onset].filter(Boolean).length ? ` (${[s.laterality, s.sensation, s.severity, s.onset].filter(Boolean).join(", ")})` : ""}`).join("; ")],
            ["Associated", c.input.complaint.associatedSymptomIds.map((x) => sym.get(x)).join(", ") || "none"],
            ["Red-flag items ticked", c.input.complaint.redFlagChecks.length ? c.input.complaint.redFlagChecks.map((f) => kb.redFlagChecklist.find((x) => x.id === f)?.label ?? f).join("; ") : "none"],
            ["Allergies", p.allergies.map((a) => a.substance).join(", ") || "none entered"],
            ["Medicines", c.input.medications.map((m) => m.name).join(", ") || "none entered"],
            ["Chronic conditions", c.input.history.chronicConditions.map((x) => cond.get(x) ?? x).join(", ") || "none entered"],
            ["Renal / hepatic", `${p.renalImpairment} / ${p.hepaticImpairment}`],
            ["Vitals", Object.entries(c.input.vitals).map(([k, v]) => `${k} ${v}`).join(", ") || "none recorded"],
            ["Systems", c.input.systems.join(", ")],
            ["Ayurvedic assessment", c.input.ayurveda ? `${c.input.ayurveda.doshaObservations.join(", ") || "no dosha observation"}; agni ${c.input.ayurveda.agni}; ama ${c.input.ayurveda.ama}` : "—"],
            ["Selected rubrics", c.input.homeopathy?.rubrics.length ? c.input.homeopathy.rubrics.map((r) => r.path).join("; ") : "none (auto-suggestion will be used)"],
          ]} />
        </section>
        <section>
          <BlockHeader title="Analyses" info={INFO.caseAnalyses} />
          {c.analyses.length === 0 ? <p className="text-sm text-ink-soft">Not analysed yet.</p> : (
            <ul className="divide-y divide-hairline rounded-[3px] border border-hairline bg-panel text-sm">
              {[...c.analyses].reverse().map((a) => (
                <li key={a.analysisId} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <Link href={`/analysis/${a.analysisId}`}>{a.createdAt.slice(0, 19).replace("T", " ")}</Link>
                  <span className="text-ink-soft">KB v{a.kbVersion}</span>
                  {a.redFlagStatus === "emergency" ? <Tag tone="danger">Emergency</Tag> : a.redFlagStatus === "urgent" ? <Tag tone="caution">Urgent</Tag> : <Tag tone="ok">Clear</Tag>}
                  {a.withheld ? <Tag>Candidates withheld</Tag> : <span className="text-ink-soft">{Object.entries(a.candidateCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8"><BlockHeader title="Clinician decisions" info={INFO.caseDecisions} /></div>
          {c.decisions.length === 0 ? <p className="text-sm text-ink-soft">No decisions recorded.</p> : (
            <ul className="space-y-2 text-sm">{c.decisions.map((d) => <li key={d.id} className="border-l-2 border-hairline pl-3"><span className="font-medium">{d.action}</span> — {d.candidateName} ({d.system}){d.alternative && <> → {d.alternative}</>}<br /><span className="text-ink-soft">{d.clinicianRef}, {d.at.slice(0, 16).replace("T", " ")}{d.reason ? ` — “${d.reason}”` : ""}</span></li>)}</ul>
          )}
          <div className="mt-8"><BlockHeader title="Audit trail" info={INFO.caseAudit} /></div>
          <p className="mb-2 text-xs text-ink-soft">Hash-chained log: {chain.ok ? `intact (${chain.count} entries in total)` : `BROKEN at entry ${chain.brokenAt}: ${chain.reason}`}.</p>
          <ol className="space-y-1 text-sm">{audit.map((a) => <li key={a.seq} className="num"><span className="text-ink-soft">#{a.seq} {a.at.slice(0, 19).replace("T", " ")}</span> {a.event}{a.analysisId ? ` · ${a.analysisId}` : ""} <span className="text-ink-faint">· KB {a.kbVersion ?? "—"} · {a.hash.slice(0, 10)}</span></li>)}</ol>
        </section>
      </div>
    </div>
  );
}
