import type { SourceRef } from "@/types/provenance";
import { getRegistry } from "@/lib/knowledge/store";

/** Renders source references with the registry name and licence; links only to http(s) URLs. */
export function SourceList({ sources, compact = false }: { sources?: SourceRef[]; compact?: boolean }) {
  if (!sources?.length) return null;
  const reg = new Map(getRegistry().map((s) => [s.id, s]));
  const seen = new Set<string>();
  const uniq = sources.filter((s) => { const k = `${s.sourceId}|${s.reference ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return (
    <ul className={compact ? "mt-1 space-y-0.5 text-xs text-ink-soft" : "mt-1.5 space-y-1 text-[0.82rem] text-ink-soft"}>
      {uniq.map((s, i) => {
        const r = reg.get(s.sourceId);
        const url = s.url && /^https?:\/\//.test(s.url) ? s.url : r?.url && /^https?:\/\//.test(r.url) ? r.url : null;
        return (
          <li key={i}>
            <span className="font-medium text-ink">{r?.name ?? s.sourceId}</span>
            {r && <span> (level {r.level})</span>}
            {s.reference && <span> — {url ? <a href={url} target="_blank" rel="noreferrer noopener">{s.reference}</a> : s.reference}</span>}
            {!s.reference && url && <span> — <a href={url} target="_blank" rel="noreferrer noopener">link</a></span>}
            {s.version && <span>; version {s.version}</span>}
            {s.lastVerified && <span>; checked {s.lastVerified}</span>}
          </li>
        );
      })}
    </ul>
  );
}
