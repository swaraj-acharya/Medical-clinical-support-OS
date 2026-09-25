import Link from "next/link";
import { SeedDemoButton } from "@/components/actions";
import { Empty, LinkButton, PageHeader, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { getKnowledge } from "@/lib/knowledge/store";
import { listCases } from "@/lib/storage/cases";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cases" };

export default function CasesPage() {
  const cases = listCases();
  const sym = new Map(getKnowledge().symptoms.map((s) => [s.id, s.label]));
  return (
    <div>
      <PageHeader title="Cases" info={INFO.cases} lead="Stored locally with pseudonymous references. Each analysis is kept with the knowledge-base version it used." actions={<><LinkButton href="/cases/new" variant="primary">Start a new case</LinkButton><SeedDemoButton /></>} />
      {cases.length === 0 ? <Empty title="No cases yet">Start a new case or load the demo cases.</Empty> : (
        <div className="overflow-x-auto rounded-[3px] border border-hairline bg-panel">
          <table className="w-full text-sm">
            <thead className="border-b border-hairline text-left text-ink-soft"><tr>{["Patient ref", "Age / sex", "Chief complaint", "Systems", "Analyses", "Decisions", "Latest safety screen", "Updated"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {cases.map((c) => {
                const s = c.analyses.at(-1)?.redFlagStatus;
                return (
                  <tr key={c.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2"><Link href={`/cases/${c.id}`}>{c.input.patient.patientRef}</Link>{c.demoKey && <span className="ml-2"><Tag>demo</Tag></span>}</td>
                    <td className="px-4 py-2">{c.input.patient.ageYears} · {c.input.patient.sex}</td>
                    <td className="px-4 py-2">{sym.get(c.input.complaint.chiefComplaintId) ?? c.input.complaint.chiefComplaintId}</td>
                    <td className="px-4 py-2">{c.input.systems.join(", ")}</td>
                    <td className="num px-4 py-2">{c.analyses.length}</td>
                    <td className="num px-4 py-2">{c.decisions.length}</td>
                    <td className="px-4 py-2">{!s ? <Tag>Not analysed</Tag> : s === "emergency" ? <Tag tone="danger">Emergency</Tag> : s === "urgent" ? <Tag tone="caution">Urgent</Tag> : <Tag tone="ok">Clear</Tag>}</td>
                    <td className="num px-4 py-2 text-ink-soft">{c.updatedAt.slice(0, 16).replace("T", " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
