import { RepertorySelector } from "@/components/repertory-selector";
import { PageHeader } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { getRubric } from "@/lib/engines/repertory";
import { getKnowledge, getRepertory } from "@/lib/knowledge/store";

export const metadata = { title: "Repertory" };

export default async function RepertoryPage({ searchParams }: { searchParams: Promise<{ rubric?: string }> }) {
  const sp = await searchParams;
  const rep = getRepertory();
  const kb = getKnowledge();
  const pre = sp.rubric ? getRubric(sp.rubric) : null;
  const ev = kb.homeopathyEvidence.find((e) => e.category === "insufficient-evidence");
  return (
    <div>
      <PageHeader title="Repertory" info={INFO.repertory} lead={<>{String(rep.meta.title)} — {rep.pathById.size.toLocaleString("en-IN")} rubrics, {rep.remedies.size.toLocaleString("en-IN")} remedies (OOREP, GPL-3.0). Navigate chapter → rubric → sub-rubric, weight characteristic rubrics, then repertorize.</>} />
      {ev && <p className="prose-measure mb-5 text-sm text-ink-soft">{ev.summary} Repertorization shows how often and how strongly remedies are listed in the chosen rubrics; it is not a probability of benefit.</p>}
      <RepertorySelector value={pre ? [{ rubricId: pre.id, path: pre.path, weight: 1 }] : []} />
    </div>
  );
}
