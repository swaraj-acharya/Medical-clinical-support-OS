import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SourceList } from "@/components/sources";
import { KV, PageHeader, Tag } from "@/components/ui";
import { getKnowledge, getMateriaMedica } from "@/lib/knowledge/store";
import { INFO } from "@/lib/content/section-info";
import { buildIndex } from "@/lib/knowledge/indexes";
import { drugSpec, formulationSpec, herbSpec, remedySpec } from "@/lib/prompts/specs";
import type { DrugRule, SafetyNote } from "@/types/knowledge";

export const dynamic = "force-dynamic";

const SEV_TONE = { contraindicated: "danger", avoid: "danger", caution: "caution", monitor: "neutral" } as const;
const NOTE_TONE = { "high-risk": "danger", warning: "caution", review: "neutral", info: "neutral" } as const;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-6"><h2 className="mb-2 text-[1.15rem]">{title}</h2>{children}</section>;
}
function Rules({ rules }: { rules: DrugRule[] }) {
  if (!rules.length) return <p className="text-sm text-ink-soft">None recorded in this knowledge base — absence here is not evidence of safety.</p>;
  return <ul className="space-y-2 text-sm">{rules.map((r) => <li key={r.id}><Tag tone={SEV_TONE[r.severity]}>{r.severity}</Tag> {r.text} <span className="text-xs text-ink-soft">(applies when: {r.when.join(", ")})</span><SourceList sources={[r.source]} compact /></li>)}</ul>;
}
function Notes({ notes }: { notes: SafetyNote[] }) {
  if (!notes.length) return <p className="text-sm text-ink-soft">No safety note recorded — safety is not established by absence of a note.</p>;
  return <ul className="space-y-2 text-sm">{notes.map((n) => <li key={n.id}><Tag tone={NOTE_TONE[n.level]}>{n.level}</Tag> {n.text}<SourceList sources={[n.source]} compact /></li>)}</ul>;
}

export default async function MedicineDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^(drug|herb|form|rem)_[A-Za-z0-9_-]{1,80}$/.test(id)) notFound();
  const kb = getKnowledge();

  if (id.startsWith("drug_")) {
    const d = kb.drugs.find((x) => x.id === id);
    if (!d) notFound();
    const ix = kb.drugInteractions.filter((x) => x.a === d.id || x.b === d.id || d.classTags.some((t) => x.a === `class:${t}` || x.b === `class:${t}`));
    const recs = kb.guidelineRecommendations.filter((r) => r.drugIds.includes(d.id));
    return (
      <div className="lane lane-allopathy pl-6">
        <PageHeader title={d.name} info={INFO.medicineDrug} prompt={drugSpec(d, buildIndex(kb))} promptLabel="Research prompt: verify and update" lead={<>{d.pharmacologicClass} · {d.routes.join(", ")} · <Tag tone={d.verification === "curated-verified" ? "ok" : "caution"}>{d.verification}</Tag></>} />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="prose-measure">
            <Block title="What does this medicine do?"><p><strong>What it is.</strong> {d.whatItIs}</p><p className="mt-2"><strong>What it does.</strong> {d.whatItDoes}</p><p className="mt-2"><strong>Mechanism.</strong> {d.mechanism}</p></Block>
            <Block title="Used for"><ul className="list-disc pl-5 text-sm">{d.usedFor.map((u) => <li key={u}>{u}</li>)}</ul></Block>
            {d.boxedWarning && <Block title="Boxed warning"><p className="rounded-[3px] bg-danger-wash px-3 py-2 text-sm text-danger">{d.boxedWarning}</p></Block>}
            <Block title="Contraindications"><Rules rules={d.contraindications} /></Block>
            <Block title="Warnings and precautions"><Rules rules={d.warnings} /></Block>
            <Block title="Adverse effects"><p className="text-sm"><strong>Common:</strong> {d.commonAdverseEffects.join("; ") || "—"}</p><p className="mt-1 text-sm"><strong>Serious:</strong> {d.seriousAdverseEffects.join("; ") || "—"}</p></Block>
            <Block title="Interactions held in this knowledge base">{ix.length ? <ul className="space-y-2 text-sm">{ix.map((x) => <li key={x.id}><Tag tone={x.severity === "major" || x.severity === "contraindicated" ? "danger" : "caution"}>{x.severity}</Tag> {x.a.replace(/^drug_|^class:/, "")} + {x.b.replace(/^drug_|^class:/, "")}: {x.effect} <span className="text-ink-soft">Management: {x.management}</span><SourceList sources={x.sources} compact /></li>)}</ul> : <p className="text-sm text-ink-soft">None recorded — use a full interaction checker.</p>}</Block>
            <Block title="Dosing"><p className="text-sm">{d.dosingNote}</p><p className="mt-1 text-sm"><a href={d.labelUrl} target="_blank" rel="noreferrer noopener">Current label</a></p></Block>
          </div>
          <aside>
            <KV items={[["Generic name", d.genericName], ["Ingredients", d.composition.map((c) => `${c.name}${c.rxcui ? ` (RXCUI ${c.rxcui})` : ""}`).join(", ")], ["RXCUI", d.rxcui], ["Classes", d.classTags.join(", ")], ["Dose forms", d.doseForms.join(", ")], ["Synonyms", d.synonyms.join(", ")]]} />
            <h3 className="mb-1 mt-5 text-base">Brand mappings</h3>
            <ul className="space-y-1 text-sm">{d.brandMappings.map((b) => <li key={b.brand + b.country}>{b.brand} ({b.country}) → {b.composition.join(" + ")} <span className="text-xs text-ink-soft">{b.verification}</span></li>)}</ul>
            <h3 className="mb-1 mt-5 text-base">Guideline links</h3>
            <ul className="space-y-1 text-sm">{recs.map((r) => <li key={r.id}><Tag tone={r.kind === "do-not-offer" ? "danger" : "allo"}>{r.kind}</Tag> {kb.conditions.find((c) => c.id === r.contextId)?.label}</li>)}</ul>
            <h3 className="mb-1 mt-5 text-base">Sources</h3>
            <SourceList sources={d.sources} />
          </aside>
        </div>
      </div>
    );
  }

  if (id.startsWith("herb_")) {
    const h = kb.ayurvedicHerbs.find((x) => x.id === id);
    if (!h) notFound();
    const forms = kb.ayurvedicFormulations.filter((f) => f.ingredientHerbIds.includes(h.id));
    return (
      <div className="lane lane-ayurveda pl-6">
        <PageHeader title={h.name} info={INFO.medicineHerb} prompt={herbSpec(h)} promptLabel="Research prompt: classical and modern evidence" lead={<><em>{h.botanicalName}</em>{h.family ? ` (${h.family})` : ""}{h.englishName ? ` · ${h.englishName}` : ""}</>} />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="prose-measure">
            <Block title="What is it used for? (traditional / classical)">
              <p className="text-sm">{h.mainIndications.join(", ") || "No indication recorded."}</p>
              <p className="mt-2 text-xs text-ink-soft">Classical indications as recorded in the source dataset — traditional rationale, not evidence of clinical efficacy.</p>
            </Block>
            <Block title="Properties (Dravyaguna)"><KV items={[["Rasa", h.rasa.join(", ")], ["Guna", h.guna.join(", ")], ["Virya", h.virya], ["Vipaka", h.vipaka], ["Karma / prabhava", h.prabhava.join(", ")], ["Pacifies", h.tridosha ? "Tridosha" : h.pacifies.join(", ")], ["Aggravates", h.aggravates.join(", ")], ["Part used", h.partUsed.join(", ")]]} /></Block>
            <Block title="Safety"><Notes notes={h.safetyNotes} /></Block>
            <Block title="Modern evidence">{h.modernEvidence.length ? <ul className="text-sm">{h.modernEvidence.map((e, i) => <li key={i}><Tag>{e.category}</Tag> {e.summary}<SourceList sources={[e.source]} compact /></li>)}</ul> : <p className="text-sm text-ink-soft">{kb.ayurvedicSafety.generalSafety.noModernEvidence.text}</p>}</Block>
          </div>
          <aside>
            <KV items={[["Sanskrit synonyms", h.sanskritSynonyms.join(", ")], ["Verification", h.verification]]} />
            <h3 className="mb-1 mt-5 text-base">Used in formulations ({forms.length})</h3>
            <ul className="space-y-0.5 text-sm">{forms.slice(0, 30).map((f) => <li key={f.id}><Link href={`/medicines/${f.id}`}>{f.name}</Link></li>)}</ul>
            <h3 className="mb-1 mt-5 text-base">Sources</h3><SourceList sources={h.sources} />
          </aside>
        </div>
      </div>
    );
  }

  if (id.startsWith("form_")) {
    const f = kb.ayurvedicFormulations.find((x) => x.id === id);
    if (!f) notFound();
    return (
      <div className="lane lane-ayurveda pl-6">
        <PageHeader title={f.name} info={INFO.medicineFormulation} prompt={formulationSpec(f)} promptLabel="Research prompt: sources, evidence and safety" lead={<>{f.formulationType} · {f.category}{f.containsMineralsOrMetals && <> · <Tag tone="danger">Rasaushadhi (mineral/metal)</Tag></>}</>} />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="prose-measure">
            <Block title="What is it used for? (as stated in the source)"><p className="text-sm">{f.indicationsText}</p><p className="mt-2 text-xs text-ink-soft">Traditional/classical statement from the dataset — not evidence of clinical efficacy.</p></Block>
            <Block title="Ingredients"><p className="text-sm">{f.ingredientsText}</p>{f.ingredientHerbIds.length > 0 && <p className="mt-2 text-sm">Linked herbs: {f.ingredientHerbIds.map((hid, i) => <span key={hid}>{i ? ", " : ""}<Link href={`/medicines/${hid}`}>{kb.ayurvedicHerbs.find((h) => h.id === hid)?.name ?? hid}</Link></span>)}</p>}</Block>
            <Block title="Source-reported dose and anupana"><p className="text-sm">{f.sourceReportedDose ? <>The source states: “{f.sourceReportedDose}”.</> : "No dose recorded."} {f.anupana ? `Anupana (vehicle) stated: ${f.anupana}.` : ""}</p><p className="mt-1 text-xs text-ink-soft">Reproduced as a source statement for reference, not a dosing recommendation. Individual dosing is the clinician's decision.</p></Block>
            <Block title="Safety"><Notes notes={f.safetyNotes} /></Block>
          </div>
          <aside>
            <KV items={[["Classical reference (as stated)", f.classicalReference || "—"], ["Verification", f.verification]]} />
            <h3 className="mb-1 mt-5 text-base">Sources</h3><SourceList sources={f.sources} />
          </aside>
        </div>
      </div>
    );
  }

  const r = kb.homeopathyRemedies.find((x) => x.id === id);
  if (!r) notFound();
  const mm = getMateriaMedica();
  const entry = mm.entries.get(r.oorepId);
  const tox = kb.homeopathyToxicSources.find((t) => t.remedyId === r.id);
  const nhmrc = kb.homeopathyEvidence.find((e) => e.category === "insufficient-evidence");
  return (
    <div className="lane lane-homeopathy pl-6">
      <PageHeader title={r.name} info={INFO.medicineRemedy} prompt={remedySpec(r, tox ? { material: tox.material, note: tox.note } : undefined)} promptLabel="Research prompt: materia medica and evidence" lead={<>Abbreviation {r.abbrev}{r.altNames.length ? ` · also ${r.altNames.join(", ")}` : ""}</>} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="prose-measure">
          {nhmrc && <p className="mb-5 rounded-[3px] bg-wash px-3 py-2 text-sm"><strong>Evidence.</strong> {nhmrc.summary}</p>}
          {tox && <Block title="Source material"><p className="text-sm"><Tag tone="caution">Toxic source</Tag> {tox.material}. {tox.note}</p><SourceList sources={tox.sources} compact /></Block>}
          <Block title={`Materia medica — ${String(mm.meta.author)} (${String(mm.meta.year)})`}>
            {entry ? entry.sections.map((s, i) => <div key={i} className="mb-3"><h3 className="text-sm font-semibold">{s.heading}</h3><p className="whitespace-pre-line font-serif text-[0.97rem] leading-relaxed">{s.text}</p></div>) : <p className="text-sm text-ink-soft">No Boericke chapter for this remedy.</p>}
            {entry && <p className="text-xs text-ink-soft">Historical text (1906) reproduced from the OOREP dataset (GPL-3.0). Traditional description, not evidence of effect.</p>}
          </Block>
        </div>
        <aside>
          <KV items={[["Repertory ID", String(r.oorepId)], ["Licence", "Repertory data GPL-3.0 (OOREP)"]]} />
          <h3 className="mb-1 mt-5 text-base">Regulatory note</h3><p className="text-sm">{kb.homeopathyRegulatory.text}</p><SourceList sources={[kb.homeopathyRegulatory.source]} compact />
        </aside>
      </div>
    </div>
  );
}
