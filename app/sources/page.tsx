import { PageHeader, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { getRegistry } from "@/lib/knowledge/store";

export const metadata = { title: "Sources & licences" };
const INTEGRATION_LABEL: Record<string, string> = {
  "bundled-import": "Imported and bundled", "bundled-subset": "Subset bundled", "api-adapter": "API importer (network)", "user-supplied-import": "Import from user-supplied file",
  "metadata-only": "Citation only", "reference-link": "Link only", "architecture-reference": "Design reference only",
};

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ system?: string; integration?: string }> }) {
  const sp = await searchParams;
  const all = getRegistry();
  const rows = all.filter((s) => (!sp.system || s.system === sp.system) && (!sp.integration || s.integration === sp.integration)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader title="Sources & licences" info={INFO.sources} lead={`${all.length} sources are registered. Each fact in the knowledge base cites one or more of them. Level 1 is most authoritative; lower-level sources never override higher-level safety information.`} />
      <form action="/sources" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label>System<select name="system" defaultValue={sp.system ?? ""} className="mt-1 block rounded-[3px] border border-hairline bg-panel px-2 py-1.5"><option value="">all</option>{["shared", "allopathy", "ayurveda", "homeopathy"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>How used<select name="integration" defaultValue={sp.integration ?? ""} className="mt-1 block rounded-[3px] border border-hairline bg-panel px-2 py-1.5"><option value="">all</option>{Object.entries(INTEGRATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="rounded-[3px] border border-hairline bg-panel px-3 py-1.5">Filter</button>
      </form>
      <div className="space-y-3">
        {rows.map((s) => (
          <article id={s.id} key={s.id} className="scroll-mt-6 rounded-[3px] border border-hairline bg-panel px-5 py-3 target:border-allo">
            <header className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-[1.05rem]"><a href={s.url} target="_blank" rel="noreferrer noopener">{s.name}</a></h2>
              <Tag>Level {s.level}</Tag><Tag>{s.system}</Tag><Tag tone={s.dataCopied ? "allo" : "neutral"}>{INTEGRATION_LABEL[s.integration] ?? s.integration}</Tag>
              {s.status !== "active" && <Tag tone="caution">{s.status}</Tag>}
            </header>
            <p className="prose-measure mt-1 text-sm">{s.description}</p>
            <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[10rem_1fr]">
              <dt className="text-ink-soft">Data licence</dt><dd>{s.dataLicense}{s.codeLicense ? ` · code ${s.codeLicense}` : ""}</dd>
              <dt className="text-ink-soft">Commercial use / redistribution</dt><dd>{s.commercialUse} / {s.redistribution}</dd>
              {s.attributionText && <><dt className="text-ink-soft">Attribution</dt><dd>{s.attributionText}</dd></>}
              {s.importedFields.length > 0 && <><dt className="text-ink-soft">Fields used</dt><dd>{s.importedFields.join(", ")}</dd></>}
              <dt className="text-ink-soft">Recommended use</dt><dd>{s.recommendedUse}</dd>
              <dt className="text-ink-soft">Last checked</dt><dd>{s.lastChecked}{s.lastUpstreamUpdate ? ` · upstream ${s.lastUpstreamUpdate}` : ""} · updates {s.updateFrequency}</dd>
              {s.notes && <><dt className="text-ink-soft">Notes</dt><dd>{s.notes}</dd></>}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
