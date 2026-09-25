import clsx from "clsx";
import Link from "next/link";
import { PageHeader, Tag } from "@/components/ui";
import { SectionTools } from "@/components/section-tools";
import { INFO } from "@/lib/content/section-info";
import { termSpec } from "@/lib/prompts/specs";
import { getKnowledge } from "@/lib/knowledge/store";
import { normalizeText } from "@/lib/normalize/text";

export const metadata = { title: "Ayurveda explorer" };
const TABS = [["herbs", "Herbs (Dravya)"], ["formulations", "Formulations (Kalpana)"], ["principles", "Principles (Siddhanta)"], ["bridges", "Symptom–term bridges"]] as const;

export default async function AyurvedaPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; dosha?: string; virya?: string; rasa?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "herbs";
  const kb = getKnowledge();
  const q = normalizeText((sp.q ?? "").slice(0, 80));
  const has = (...xs: (string | undefined)[]) => !q || xs.some((x) => x && normalizeText(x).includes(q));
  const eq = (a: string, b?: string) => !b || normalizeText(a) === normalizeText(b);
  const rasas = [...new Set(kb.ayurvedicHerbs.flatMap((h) => h.rasa))].filter(Boolean).sort();
  const viryas = [...new Set(kb.ayurvedicHerbs.map((h) => h.virya))].filter(Boolean).sort();
  const herbs = kb.ayurvedicHerbs.filter((h) => has(h.name, h.botanicalName, h.englishName, ...h.mainIndications) && (!sp.dosha || h.tridosha || h.pacifies.some((p) => eq(p, sp.dosha))) && eq(h.virya || "", sp.virya) && (!sp.rasa || h.rasa.some((r) => eq(r, sp.rasa))));
  const forms = kb.ayurvedicFormulations.filter((f) => has(f.name, f.category, f.indicationsText, ...f.mainIngredients));
  const principles = kb.ayurvedicPrinciples.filter((p) => has(p.name, p.category, p.explanation));
  const bridges = kb.ayurvedicIndications.filter((t) => has(t.term, t.label, ...t.variants));
  const qs = (extra: Record<string, string>) => new URLSearchParams(Object.entries({ tab, ...(sp.q ? { q: sp.q } : {}), ...extra }).filter(([, v]) => v)).toString();
  return (
    <div>
      <PageHeader title="Ayurveda explorer" info={INFO.ayurvedaExplorer} lead="Classical properties and indications from open datasets (Amidha Ayurveda, CC BY 4.0). Traditional rationale is kept separate from modern evidence throughout." />
      <nav aria-label="Ayurveda sections" className="mb-4 flex flex-wrap gap-1 border-b border-hairline">
        {TABS.map(([t, l]) => <Link key={t} href={`/ayurveda?tab=${t}`} aria-current={t === tab ? "page" : undefined} className={clsx("-mb-px border-b-2 px-3 py-2 text-sm hover:no-underline", t === tab ? "border-ayur font-medium text-ink" : "border-transparent text-ink-soft")}>{l}</Link>)}
      </nav>
      <form action="/ayurveda" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <input type="hidden" name="tab" value={tab} />
        <label>Search<input name="q" defaultValue={sp.q ?? ""} className="mt-1 block w-64 rounded-[3px] border border-hairline bg-panel px-2 py-1.5" /></label>
        {tab === "herbs" && <>
          <label>Pacifies<select name="dosha" defaultValue={sp.dosha ?? ""} className="mt-1 block rounded-[3px] border border-hairline bg-panel px-2 py-1.5"><option value="">any</option>{["Vata", "Pitta", "Kapha"].map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Virya<select name="virya" defaultValue={sp.virya ?? ""} className="mt-1 block rounded-[3px] border border-hairline bg-panel px-2 py-1.5"><option value="">any</option>{viryas.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Rasa<select name="rasa" defaultValue={sp.rasa ?? ""} className="mt-1 block rounded-[3px] border border-hairline bg-panel px-2 py-1.5"><option value="">any</option>{rasas.map((d) => <option key={d}>{d}</option>)}</select></label>
        </>}
        <button className="rounded-[3px] border border-hairline bg-panel px-3 py-1.5">Apply</button>
        <Link href={`/ayurveda?${qs({})}`} className="self-center text-ink-soft">Reset filters</Link>
      </form>

      {sp.q && <SectionTools className="mb-4" prompt={termSpec(sp.q, { hint: "ayurveda", nearMatches: [...herbs.slice(0, 4).map((h) => h.name), ...forms.slice(0, 4).map((f) => f.name)] })} promptLabel={`Research prompt for “${sp.q}”`} />}
      {tab === "herbs" && (
        <div className="overflow-x-auto rounded-[3px] border border-hairline bg-panel">
          <table className="w-full text-sm">
            <thead className="border-b border-hairline text-left text-ink-soft"><tr>{["Herb", "Rasa", "Virya", "Vipaka", "Pacifies", "Main indications"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{herbs.slice(0, 200).map((h) => <tr key={h.id} className="border-b border-hairline align-top last:border-0"><td className="px-3 py-1.5"><Link href={`/medicines/${h.id}`} className="font-medium">{h.name}</Link><br /><em className="text-xs text-ink-soft">{h.botanicalName}</em></td><td className="px-3 py-1.5">{h.rasa.join(", ")}</td><td className="px-3 py-1.5">{h.virya}</td><td className="px-3 py-1.5">{h.vipaka}</td><td className="px-3 py-1.5">{h.tridosha ? "Tridosha" : h.pacifies.join(", ")}</td><td className="px-3 py-1.5 text-ink-soft">{h.mainIndications.slice(0, 6).join(", ")}</td></tr>)}</tbody>
          </table>
          <p className="px-3 py-2 text-xs text-ink-soft">{herbs.length} herbs match{herbs.length > 200 ? " (first 200 shown)" : ""}.</p>
        </div>
      )}
      {tab === "formulations" && (
        <ul className="divide-y divide-hairline rounded-[3px] border border-hairline bg-panel text-sm">
          {forms.slice(0, 200).map((f) => <li key={f.id} className="px-4 py-2"><Link href={`/medicines/${f.id}`} className="font-medium">{f.name}</Link> <span className="text-ink-soft">{f.formulationType} · {f.category}</span>{f.containsMineralsOrMetals && <span className="ml-2"><Tag tone="danger">mineral/metal</Tag></span>}<p className="text-ink-soft">{f.indicationsText.slice(0, 220)}{f.indicationsText.length > 220 ? "…" : ""}</p></li>)}
        </ul>
      )}
      {tab === "principles" && (
        <ul className="space-y-4">{principles.slice(0, 120).map((p) => <li key={p.id} className="prose-measure"><h3 className="text-base">{p.name} <span className="font-sans text-sm font-normal text-ink-soft">{p.category}</span></h3>{p.shloka && <p className="mt-1 whitespace-pre-line font-serif text-sm">{p.shloka}{p.shlokaRef ? <span className="text-ink-soft"> — {p.shlokaRef}</span> : null}</p>}<p className="mt-1 text-sm">{p.explanation}</p>{p.clinicalImportance && <p className="mt-1 text-sm text-ink-soft">{p.clinicalImportance}</p>}</li>)}</ul>
      )}
      {tab === "bridges" && (
        <div>
          <p className="prose-measure mb-3 text-sm text-ink-soft">These bridges connect symptoms entered in a case to classical terms used in the datasets. They are approximate correlates chosen for search and matching — not NAMASTE codes and not diagnostic equivalences.</p>
          <ul className="divide-y divide-hairline rounded-[3px] border border-hairline bg-panel text-sm">{bridges.map((t) => <li key={t.term} className="px-4 py-2"><span className="font-medium">{t.label}</span> <span className="text-ink-soft">({[t.term, ...t.variants].join(", ")})</span> ↔ {t.symptomIds.map((s) => kb.symptoms.find((x) => x.id === s)?.label ?? s).join(", ")}{t.requiresDetail && <span className="text-ink-soft"> · only when {t.requiresDetail.field} is {t.requiresDetail.anyOf.join("/")}</span>}<p className="text-xs text-ink-soft">{t.note}</p></li>)}</ul>
        </div>
      )}
    </div>
  );
}
