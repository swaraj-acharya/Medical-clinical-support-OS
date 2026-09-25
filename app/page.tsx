import Link from "next/link";
import { SeedDemoButton } from "@/components/actions";
import { BlockHeader, Empty, LinkButton, PageHeader, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { getKnowledge, getRepertory, getValidationReport } from "@/lib/knowledge/store";
import { listCases } from "@/lib/storage/cases";

export const dynamic = "force-dynamic";

function StatusTag({ s }: { s: string | null }) {
  if (!s) return <Tag>Not analysed</Tag>;
  if (s === "emergency") return <Tag tone="danger">Emergency red flag</Tag>;
  if (s === "urgent") return <Tag tone="caution">Urgent red flag</Tag>;
  return <Tag tone="ok">No red flag matched</Tag>;
}

export default function Dashboard() {
  const kb = getKnowledge();
  const rep = getRepertory();
  const report = getValidationReport();
  const cases = listCases();
  const sym = new Map(kb.symptoms.map((s) => [s.id, s.label]));
  const pending = report?.provenance.byVerification["curated-pending-verification"] ?? 0;
  const lanes = [
    { key: "allopathy", title: "Allopathy", cls: "lane-allopathy", rows: [["Clinical contexts", kb.conditions.length], ["Guidelines cited", kb.clinicalGuidelines.length], ["Medicines", kb.drugs.length], ["Interaction rules", kb.drugInteractions.length]] },
    { key: "ayurveda", title: "Ayurveda", cls: "lane-ayurveda", rows: [["Herbs (dravya)", kb.ayurvedicHerbs.length], ["Formulations", kb.ayurvedicFormulations.length], ["Principles", kb.ayurvedicPrinciples.length], ["Term bridges", kb.ayurvedicIndications.length]] },
    { key: "homeopathy", title: "Homeopathy", cls: "lane-homeopathy", rows: [["Remedies", kb.homeopathyRemedies.length], ["Rubrics", rep.pathById.size], ["Rubric–remedy grades", Object.values(rep.relations).reduce((a, r) => a + r.length, 0)], ["Materia medica chapters", kb.homeopathyMateriaMedica.length]] },
  ] as const;
  return (
    <div>
      <PageHeader title="Dashboard" info={INFO.dashboard} lead={<>Knowledge base v{kb.metadata.version}, built {kb.metadata.generatedAt.slice(0, 10)}. Safety screening runs first on every case ({kb.redFlags.length} red-flag rules).</>}
        actions={<><LinkButton href="/cases/new" variant="primary">Start a new case</LinkButton><SeedDemoButton /></>} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="recent">
          <BlockHeader id="recent" title="Recent cases" info={INFO.cases} />
          {cases.length === 0 ? (
            <Empty title="No cases yet">Start a new case, or load the fictional demo cases to see each workflow (repertory, Ayurvedic matching, red-flag blocking, drug interactions).</Empty>
          ) : (
            <div className="overflow-x-auto rounded-[3px] border border-hairline bg-panel">
              <table className="w-full text-sm">
                <thead className="border-b border-hairline text-left text-ink-soft">
                  <tr><th className="px-4 py-2 font-medium">Patient ref</th><th className="px-4 py-2 font-medium">Chief complaint</th><th className="px-4 py-2 font-medium">Safety screen</th><th className="px-4 py-2 font-medium">Decisions</th><th className="px-4 py-2 font-medium">Updated</th></tr>
                </thead>
                <tbody>
                  {cases.slice(0, 12).map((c) => (
                    <tr key={c.id} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-2"><Link href={`/cases/${c.id}`}>{c.input.patient.patientRef}</Link>{c.demoKey && <span className="ml-2"><Tag>demo</Tag></span>}</td>
                      <td className="px-4 py-2">{sym.get(c.input.complaint.chiefComplaintId) ?? c.input.complaint.chiefComplaintId}<span className="text-ink-soft"> · {c.input.patient.ageYears} y, {c.input.patient.sex}</span></td>
                      <td className="px-4 py-2"><StatusTag s={c.analyses.at(-1)?.redFlagStatus ?? null} /></td>
                      <td className="num px-4 py-2">{c.decisions.length}</td>
                      <td className="num px-4 py-2 text-ink-soft">{c.updatedAt.slice(0, 16).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside aria-labelledby="kb">
          <BlockHeader id="kb" title="What the knowledge base holds" info={INFO.kbSummary} />
          <div className="space-y-3">
            {lanes.map((l) => (
              <div key={l.key} className={`lane ${l.cls} bg-panel py-2.5 pl-4 pr-3`}>
                <h3 className="mb-1">{l.title}</h3>
                <dl className="grid grid-cols-[1fr_auto] gap-y-0.5 text-sm">
                  {l.rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-soft">{k}</dt><dd className="num text-right">{Number(v).toLocaleString("en-IN")}</dd></div>)}
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            {pending} curated facts are marked <em>pending verification</em> and must be checked against the cited source before clinical use. See <Link href="/admin">Data health</Link> and <Link href="/sources">Sources & licences</Link>.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {kb.metadata.scopeNotes.slice(0, 2).map((n) => <li key={n}>{n}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}
