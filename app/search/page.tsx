import Link from "next/link";
import { PageHeader, Tag } from "@/components/ui";
import { SectionTools } from "@/components/section-tools";
import { INFO } from "@/lib/content/section-info";
import { termSpec } from "@/lib/prompts/specs";
import { buildIndex } from "@/lib/knowledge/indexes";
import { getKnowledge } from "@/lib/knowledge/store";
import { globalSearch, type SearchHit, type SearchType } from "@/lib/search/global";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };
const TYPE_LABEL: Record<SearchType, string> = { symptom: "Symptoms", medicine: "Allopathic medicines", herb: "Ayurvedic herbs", formulation: "Ayurvedic formulations", principle: "Ayurvedic principles", remedy: "Homeopathic remedies", rubric: "Repertory rubrics", context: "Clinical contexts", guideline: "Guidelines", "red-flag": "Red-flag rules", source: "Sources" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const type = sp.type && sp.type in TYPE_LABEL ? (sp.type as SearchType) : undefined;
  const hits = q ? globalSearch(q, buildIndex(getKnowledge()), { limit: 120, types: type ? [type] : undefined }) : [];
  const groups = new Map<SearchType, SearchHit[]>();
  for (const h of hits) groups.set(h.type, [...(groups.get(h.type) ?? []), h]);
  return (
    <div>
      <PageHeader title="Search" info={INFO.search} lead="Symptoms (English, Hinglish, Ayurvedic terms), medicines and brands, herbs, formulations, remedies, rubrics, guidelines and sources. Spelling variants are matched and labelled." />
      <form action="/search" role="search" className="mb-6 flex max-w-2xl gap-2">
        <label htmlFor="gq" className="sr-only">Search</label>
        <input id="gq" name="q" defaultValue={q} autoFocus placeholder="e.g. sar dard, Crocin, amlapitta, Belladonna, head pain sun" className="w-full rounded-[3px] border border-hairline bg-panel px-3 py-2" />
        <button className="rounded-[3px] bg-ink px-4 py-2 text-white">Search</button>
      </form>
      {q && hits.length === 0 && <p className="mb-3 text-ink-soft">“{q}” is not in the knowledge base. Try another spelling, or research it with the prompt below.</p>}
      {q && <SectionTools className="mb-6" prompt={termSpec(q, { nearMatches: hits.slice(0, 8).map((h) => `${h.label} (${TYPE_LABEL[h.type]}, ${h.matchType} match)`) })} promptLabel={hits.length ? `Not what you need? Research prompt for “${q}”` : `Research prompt for “${q}”`} defaultOpen={hits.length ? undefined : "prompt"} />}
      <div className="space-y-6">
        {[...groups.entries()].map(([t, hs]) => (
          <section key={t}>
            <h2 className="mb-2 text-[1.1rem]">{TYPE_LABEL[t]} <span className="font-sans text-sm font-normal text-ink-soft">({hs.length})</span></h2>
            <ul className="divide-y divide-hairline rounded-[3px] border border-hairline bg-panel text-sm">
              {hs.map((h) => (
                <li key={h.type + h.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-1.5">
                  {h.href.startsWith("http") ? <a href={h.href} target="_blank" rel="noreferrer noopener" className="font-medium">{h.label}</a> : <Link href={h.href} className="font-medium">{h.label}</Link>}
                  <span className="text-ink-soft">{h.detail}</span>
                  <span className="ml-auto"><Tag tone={h.matchType === "fuzzy" ? "caution" : "neutral"}>{h.matchType}{h.matchedTerm !== h.label ? `: “${h.matchedTerm}”` : ""}</Tag></span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
