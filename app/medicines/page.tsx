import clsx from "clsx";
import Link from "next/link";
import { PageHeader, Tag } from "@/components/ui";
import { SectionTools } from "@/components/section-tools";
import { INFO } from "@/lib/content/section-info";
import { termSpec } from "@/lib/prompts/specs";
import { getKnowledge } from "@/lib/knowledge/store";
import { normalizeText } from "@/lib/normalize/text";

export const metadata = { title: "Medicines" };
const TABS = [["drugs", "Allopathic medicines"], ["herbs", "Ayurvedic herbs"], ["formulations", "Ayurvedic formulations"], ["remedies", "Homeopathic remedies"]] as const;

export default async function MedicinesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "drugs";
  const q = normalizeText((sp.q ?? "").slice(0, 80));
  const kb = getKnowledge();
  const has = (...xs: (string | undefined)[]) => !q || xs.some((x) => x && normalizeText(x).includes(q));
  const rows: { id: string; name: string; sub: string; tag?: string }[] =
    tab === "drugs" ? kb.drugs.filter((d) => has(d.name, d.genericName, ...d.synonyms, ...d.brandMappings.map((b) => b.brand))).map((d) => ({ id: d.id, name: d.name, sub: d.pharmacologicClass, tag: d.verification }))
    : tab === "herbs" ? kb.ayurvedicHerbs.filter((h) => has(h.name, h.botanicalName, h.englishName, ...h.sanskritSynonyms)).map((h) => ({ id: h.id, name: h.name, sub: `${h.botanicalName}${h.englishName ? ` · ${h.englishName}` : ""}` }))
    : tab === "formulations" ? kb.ayurvedicFormulations.filter((f) => has(f.name, f.category, ...f.mainIngredients)).map((f) => ({ id: f.id, name: f.name, sub: `${f.formulationType} · ${f.category}`, tag: f.containsMineralsOrMetals ? "mineral/metal" : undefined }))
    : kb.homeopathyRemedies.filter((r) => has(r.name, r.abbrev, ...r.altNames)).map((r) => ({ id: r.id, name: r.name, sub: r.abbrev, tag: r.toxicSource ? "toxic source" : undefined }));
  return (
    <div>
      <PageHeader title="Medicines" info={INFO.medicines} lead="Reference entries from each system, with sources. Open any entry for “What does this medicine do?”." />
      <nav aria-label="Medicine type" className="mb-4 flex flex-wrap gap-1 border-b border-hairline">
        {TABS.map(([t, l]) => <Link key={t} href={`/medicines?tab=${t}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} aria-current={t === tab ? "page" : undefined} className={clsx("-mb-px border-b-2 px-3 py-2 text-sm hover:no-underline", t === tab ? "border-ink font-medium text-ink" : "border-transparent text-ink-soft")}>{l}</Link>)}
      </nav>
      <form className="mb-4 flex gap-2" action="/medicines">
        <input type="hidden" name="tab" value={tab} />
        <label htmlFor="mq" className="sr-only">Filter</label>
        <input id="mq" name="q" defaultValue={sp.q ?? ""} placeholder="Filter by name, synonym or brand" className="w-full max-w-md rounded-[3px] border border-hairline bg-panel px-3 py-1.5" />
        <button className="rounded-[3px] border border-hairline bg-panel px-3 py-1.5 text-sm">Filter</button>
      </form>
      {sp.q && <SectionTools className="mb-4" defaultOpen={rows.length ? undefined : "prompt"}
        prompt={termSpec(sp.q, { hint: tab === "drugs" ? "medicine" : tab === "remedies" ? "homeopathy" : "ayurveda", nearMatches: rows.slice(0, 8).map((r) => r.name) })}
        promptLabel={rows.length ? `Not listed? Research prompt for “${sp.q}”` : `“${sp.q}” is not in the knowledge base — research prompt`} />}
      <p className="mb-2 text-sm text-ink-soft">{rows.length.toLocaleString("en-IN")} entr{rows.length === 1 ? "y" : "ies"}{rows.length > 400 ? " — showing the first 400; refine the filter" : ""}.</p>
      <ul className="divide-y divide-hairline rounded-[3px] border border-hairline bg-panel text-sm">
        {rows.slice(0, 400).map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-1.5">
            <Link href={`/medicines/${r.id}`} className="font-medium">{r.name}</Link><span className="text-ink-soft">{r.sub}</span>
            {r.tag && <span className="ml-auto"><Tag tone={r.tag === "curated-pending-verification" ? "caution" : r.tag === "imported-from-source" ? "neutral" : "danger"}>{r.tag}</Tag></span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
