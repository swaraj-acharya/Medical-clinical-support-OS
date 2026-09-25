import Link from "next/link";
import { ReloadKnowledgeButton } from "@/components/actions";
import { SourceList } from "@/components/sources";
import { KV, PageHeader, Section, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { verificationSpec } from "@/lib/prompts/specs";
import { getKnowledge, getValidationReport } from "@/lib/knowledge/store";
import { verifyAuditChain } from "@/lib/storage/audit";
import { listCases } from "@/lib/storage/cases";
import type { RuleExpr } from "@/types/knowledge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data health" };

function describe(e: RuleExpr, sym: Map<string, string>, flags: Map<string, string>): string {
  if ("all" in e) return e.all.map((x) => describe(x, sym, flags)).join(" AND ");
  if ("any" in e) return `(${e.any.map((x) => describe(x, sym, flags)).join(" OR ")})`;
  if ("countAtLeast" in e) return `≥${e.countAtLeast.n} of [${e.countAtLeast.of.map((x) => describe(x, sym, flags)).join("; ")}]`;
  if ("symptom" in e) return sym.get(e.symptom) ?? e.symptom;
  if ("flag" in e) return `“${flags.get(e.flag) ?? e.flag}”`;
  if ("detail" in e) return `${sym.get(e.detail.symptomId)} ${e.detail.field} ${e.detail.anyOf.join("/")}`;
  if ("vital" in e) return `${e.vital.name} ${e.vital.op} ${e.vital.value}`;
  if ("ageYears" in e) return `age ${e.ageYears.op} ${e.ageYears.value}`;
  if ("pregnant" in e) return "pregnant";
  if ("durationOver" in e) return `${sym.get(e.durationOver.symptomId)} > ${e.durationOver.days} days`;
  return "?";
}

export default function AdminPage() {
  const kb = getKnowledge();
  const r = getValidationReport();
  const chain = verifyAuditChain();
  const cases = listCases();
  const sym = new Map(kb.symptoms.map((s) => [s.id, s.label]));
  const flags = new Map(kb.redFlagChecklist.map((f) => [f.id, f.label]));
  return (
    <div>
      <PageHeader title="Data health" info={INFO.admin} prompt={verificationSpec(kb.drugs)} promptLabel="Research prompt: verify pending drug facts" lead="Validation of the knowledge base, provenance coverage, audit-log integrity and the complete red-flag rule set." actions={<ReloadKnowledgeButton />} />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-[3px] border border-hairline bg-panel p-4">
          <h2 className="text-base">Knowledge base</h2>
          <KV items={[["Version", kb.metadata.version], ["Content hash", <span key="h" className="num break-all text-xs">{kb.metadata.contentHash}</span>], ["Built", kb.metadata.generatedAt.replace("T", " ").slice(0, 19)], ["Jurisdiction", kb.metadata.jurisdiction]]} />
        </div>
        <div className="rounded-[3px] border border-hairline bg-panel p-4">
          <h2 className="text-base">Validation</h2>
          {r ? <KV items={[["Errors", <Tag key="e" tone={r.errors.length ? "danger" : "ok"}>{r.errors.length}</Tag>], ["Warnings", r.warnings.length], ["Provenance coverage", `${r.provenance.coveragePercent}% of ${r.provenance.entitiesChecked} entities`], ["Pending verification", r.provenance.byVerification["curated-pending-verification"] ?? 0], ["Report generated", r.generatedAt.slice(0, 19).replace("T", " ")]]} /> : <p className="text-sm text-danger">No validation report. Run npm run knowledge:validate.</p>}
        </div>
        <div className="rounded-[3px] border border-hairline bg-panel p-4">
          <h2 className="text-base">Audit log</h2>
          <KV items={[["Chain", chain.ok ? <Tag key="c" tone="ok">intact</Tag> : <Tag key="c" tone="danger">broken at #{chain.brokenAt}</Tag>], ["Entries", chain.count], ["Cases stored", cases.length], ["Storage", "local files (data/runtime)"]]} />
          {!chain.ok && <p className="mt-2 text-sm text-danger">{chain.reason}</p>}
        </div>
      </div>

      {r && (r.errors.length > 0 || r.warnings.length > 0 || (r as { dataQualityNotes?: string[] }).dataQualityNotes?.length) && (
        <Section title="Validation findings and data-quality notes">
          <ul className="space-y-1 text-sm">
            {r.errors.map((e) => <li key={e}><Tag tone="danger">error</Tag> {e}</li>)}
            {r.warnings.map((e) => <li key={e}><Tag tone="caution">warning</Tag> {e}</li>)}
            {((r as { dataQualityNotes?: string[] }).dataQualityNotes ?? []).map((e) => <li key={e}><Tag>data quality</Tag> {e}</li>)}
          </ul>
        </Section>
      )}

      <Section title="Collections" open={false}>
        <table className="text-sm"><tbody>{Object.entries(r?.counts ?? {}).map(([k, v]) => <tr key={k}><td className="pr-6 text-ink-soft">{k}</td><td className="num text-right">{v.toLocaleString("en-IN")}</td></tr>)}</tbody></table>
        <h3 className="mb-1 mt-4 text-base">Data packs</h3>
        <ul className="text-sm">{kb.metadata.packs.map((p) => <li key={p.id}>{p.file} — {p.license} — <span className="num text-xs">{p.sha256.slice(0, 16)}…</span></li>)}</ul>
        <h3 className="mb-1 mt-4 text-base">Scope notes</h3>
        <ul className="list-disc pl-5 text-sm">{kb.metadata.scopeNotes.map((n) => <li key={n}>{n}</li>)}</ul>
      </Section>

      <Section id="red-flags" info={INFO.analysisGate} title="Red-flag rules" summary={`${kb.redFlags.length} rules`} open={false}>
        <ul className="space-y-3">
          {kb.redFlags.map((f) => (
            <li key={f.id} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-2"><Tag tone={f.severity === "emergency" ? "danger" : "caution"}>{f.severity}</Tag><span className="font-medium">{f.title}</span><span className="text-xs text-ink-soft">{f.category} · population {f.population} · {f.verification}</span></div>
              <p className="text-xs text-ink-soft">When: {describe(f.when, sym, flags)}</p>
              <p>{f.guidance}</p>
              <SourceList sources={f.sources} compact />
            </li>
          ))}
        </ul>
      </Section>
      <p className="text-sm text-ink-soft">To update the knowledge base safely run <code>npm run knowledge:update</code> (stages, validates and diffs; promotion requires <code>--promote</code>). See <Link href="/sources">Sources & licences</Link>.</p>
    </div>
  );
}
