import Link from "next/link";
import { Empty, PageHeader, SafetyStatusTag, SYSTEM_LABEL, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { getAnalysis, listCases } from "@/lib/storage/cases";
import type { AnalysisResult, Candidate } from "@/types/recommendation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommendations" };

export default function RecommendationsPage() {
  const rows = listCases().flatMap((c) => {
    const last = c.analyses.at(-1);
    if (!last) return [];
    let a: AnalysisResult;
    try { a = getAnalysis(last.analysisId); } catch { return []; }
    return [{ c, a }];
  });
  return (
    <div>
      <PageHeader title="Recommendations" info={INFO.recommendations} lead="Latest analysis for each case: candidates awaiting review and the decisions already recorded. Candidates are suggestions for clinician review, not prescriptions." />
      {rows.length === 0 ? <Empty title="No analysed cases">Run an analysis on a case to see its candidates here.</Empty> : (
        <div className="space-y-5">
          {rows.map(({ c, a }) => {
            const cands: Candidate[] = [...(a.allopathy?.candidates ?? []), ...(a.ayurveda?.candidates ?? []), ...(a.homeopathy?.candidates ?? [])];
            const decided = new Map(c.decisions.filter((d) => d.analysisId === a.analysisId).map((d) => [d.candidateId, d]));
            return (
              <section key={c.id} className="rounded-[3px] border border-hairline bg-panel px-5 py-4">
                <header className="mb-2 flex flex-wrap items-baseline gap-3">
                  <h2 className="text-[1.1rem]"><Link href={`/analysis/${a.analysisId}`}>{c.input.patient.patientRef}</Link></h2>
                  <span className="text-sm text-ink-soft">{a.normalizedSymptoms.filter((s) => s.role !== "associated").map((s) => s.label).join(", ")}</span>
                  {a.redFlags.status !== "clear" && <Tag tone={a.redFlags.status === "emergency" ? "danger" : "caution"}>{a.redFlags.status} red flag</Tag>}
                  <span className="ml-auto text-xs text-ink-soft">{decided.size}/{cands.length} reviewed · KB v{a.knowledgeBaseVersion}</span>
                </header>
                {a.candidatesWithheld ? <p className="text-sm">{a.withheldReason}</p> : cands.length === 0 ? <p className="text-sm text-ink-soft">No candidates in this analysis.</p> : (
                  <ul className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                    {cands.slice(0, 12).map((cd) => {
                      const d = decided.get(cd.id);
                      return <li key={cd.id} className={`lane lane-${cd.system} flex flex-wrap items-baseline gap-2 pl-3`}><span className="text-xs text-ink-soft">{SYSTEM_LABEL[cd.system]}</span><Link href={`/medicines/${cd.entityId}`}>{cd.name}</Link><SafetyStatusTag status={cd.safetyStatus} />{d ? <Tag tone="allo">{d.action}</Tag> : <Tag>awaiting review</Tag>}</li>;
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
