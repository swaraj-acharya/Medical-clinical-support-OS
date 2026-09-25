"use client";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { repertorySpec } from "@/lib/prompts/specs";
import { SectionTools } from "./section-tools";
import { buttonClass } from "./ui";

export interface SelectedRubric { rubricId: string; path: string; weight: number }
interface Node { id: string; path: string; label: string; chapter: string; depth: number; childCount: number; remedyCount: number }
interface Row { remedyId: string; abbrev: string; name: string; covered: number; gradeSum: number; weightedScore: number; grades: Record<string, number> }

const GRADE_BG = ["bg-transparent", "bg-homeo-wash", "bg-[#dcc8e5]", "bg-homeo text-white"];

/**
 * Repertory selector: chapter → rubric → sub-rubric navigation, search, weighted selection and repertorization.
 * The result is a repertory cross-reference (coverage, grade sum) — never a probability.
 */
export function RepertorySelector({ value, onChange, showRepertorize = true }: { value?: SelectedRubric[]; onChange?: (v: SelectedRubric[]) => void; showRepertorize?: boolean }) {
  const [trail, setTrail] = useState<string[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Node[] | null>(null);
  const [selected, setSelected] = useState<SelectedRubric[]>(value ?? []);
  const [result, setResult] = useState<{ rows: Row[]; rubrics: (Node & { weight: number })[]; method: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const current = trail.at(-1) ?? null;

  useEffect(() => {
    let live = true;
    fetch(`/api/repertory/children${current ? `?path=${encodeURIComponent(current)}` : ""}`).then((r) => r.json()).then((d) => { if (live) setNodes(d.children ?? []); }).catch(() => setErr("Could not load the repertory."));
    return () => { live = false; };
  }, [current]);

  useEffect(() => {
    if (q.trim().length < 3) { setHits(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/repertory/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setHits(d.results ?? [])).catch(() => setErr("Search failed."));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const update = useCallback((next: SelectedRubric[]) => { setSelected(next); setResult(null); onChange?.(next); }, [onChange]);
  const add = (n: Node) => { if (!selected.some((s) => s.rubricId === n.id) && selected.length < 40) update([...selected, { rubricId: n.id, path: n.path, weight: 1 }]); };

  const repertorize = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/repertory/repertorize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rubrics: selected.map(({ rubricId, weight }) => ({ rubricId, weight })) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Repertorization failed");
      setResult(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const list = hits ?? nodes;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <label className="block text-sm font-medium" htmlFor="rubric-search">Find a rubric</label>
        <input id="rubric-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. head pain sun, throat swallowing, nausea"
          className="mt-1 w-full rounded-[3px] border border-hairline bg-panel px-3 py-2" />
        {!hits && (
          <nav aria-label="Rubric path" className="mt-3 flex flex-wrap items-center gap-1 text-sm">
            <button type="button" className="text-allo hover:underline" onClick={() => setTrail([])}>Chapters</button>
            {trail.map((p, i) => (
              <span key={p} className="flex items-center gap-1"><span className="text-ink-faint">/</span>
                <button type="button" className="text-allo hover:underline" onClick={() => setTrail(trail.slice(0, i + 1))}>{i === 0 ? p : p.slice(trail[i - 1].length + 2)}</button>
              </span>
            ))}
          </nav>
        )}
        {hits && <p className="mt-3 text-sm text-ink-soft">{hits.length} rubric{hits.length === 1 ? "" : "s"} contain every word of “{q}”.</p>}
        <ul className="mt-2 max-h-[26rem] divide-y divide-hairline overflow-y-auto rounded-[3px] border border-hairline bg-panel">
          {list.length === 0 && <li className="px-3 py-3 text-sm text-ink-soft">{hits ? "No rubric matches. Try fewer or different words." : "Loading…"}</li>}
          {list.map((n) => {
            const chosen = selected.some((s) => s.rubricId === n.id);
            return (
              <li key={n.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                {n.childCount > 0 && !hits ? (
                  <button type="button" className="min-w-0 flex-1 text-left hover:underline" onClick={() => setTrail([...trail, n.path])}>{n.label} <span className="text-ink-faint">({n.childCount} sub-rubrics)</span></button>
                ) : (
                  <span className="min-w-0 flex-1">{hits ? n.path : n.label}</span>
                )}
                <span className="num shrink-0 text-xs text-ink-faint" title="Remedies listed in this rubric">{n.remedyCount}</span>
                <button type="button" disabled={chosen || n.remedyCount === 0} onClick={() => add(n)} className={buttonClass("secondary", "sm")}>{chosen ? "Added" : "Add"}</button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-base">Selected rubrics <span className="font-sans text-sm font-normal text-ink-soft">({selected.length}/40)</span></h3>
        {selected.length === 0 ? <p className="mt-2 text-sm text-ink-soft">Add rubrics from the list. Weight 2–3 marks characteristic symptoms (modalities, strange/peculiar features).</p> : (
          <ul className="mt-2 divide-y divide-hairline rounded-[3px] border border-hairline bg-panel">
            {selected.map((s) => (
              <li key={s.rubricId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1">{s.path}</span>
                <label className="sr-only" htmlFor={`w-${s.rubricId}`}>Weight</label>
                <select id={`w-${s.rubricId}`} value={s.weight} onChange={(e) => update(selected.map((x) => (x.rubricId === s.rubricId ? { ...x, weight: Number(e.target.value) } : x)))} className="rounded-[3px] border border-hairline bg-panel px-1 py-0.5">
                  {[1, 2, 3].map((w) => <option key={w} value={w}>×{w}</option>)}
                </select>
                <button type="button" onClick={() => update(selected.filter((x) => x.rubricId !== s.rubricId))} className="text-danger hover:underline" aria-label={`Remove ${s.path}`}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {showRepertorize && (
          <div className="mt-3">
            <button type="button" className={buttonClass("primary")} disabled={!selected.length || busy} onClick={repertorize}>{busy ? "Repertorizing…" : "Repertorize"}</button>
          </div>
        )}
        {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
        {result && (
          <div className="mt-4">
            <p className="text-xs text-ink-soft">{result.method}</p>
            <div className="mt-2 overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-ink-soft">
                    <th className="py-1 pr-3 font-medium">Remedy</th><th className="px-2 font-medium" title="Rubrics covered">Cov.</th><th className="px-2 font-medium">Grades</th><th className="px-2 font-medium">Wtd</th>
                    {result.rubrics.map((r, i) => <th key={r.id} className="px-1 font-medium" title={r.path}>R{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 20).map((row) => (
                    <tr key={row.remedyId} className="border-t border-hairline">
                      <td className="py-1 pr-3"><a href={`/medicines/${row.remedyId}`} title={row.name}>{row.abbrev}</a></td>
                      <td className="num px-2">{row.covered}/{result.rubrics.length}</td><td className="num px-2">{row.gradeSum}</td><td className="num px-2">{row.weightedScore}</td>
                      {result.rubrics.map((r) => { const g = row.grades[r.id] ?? 0; return <td key={r.id} className="px-0.5"><span className={clsx("num inline-block w-6 rounded-[2px] text-center text-xs", GRADE_BG[g])}>{g || "·"}</span></td>; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="mt-2 space-y-0.5 text-xs text-ink-soft">{result.rubrics.map((r, i) => <li key={r.id}>R{i + 1}: {r.path} (×{r.weight})</li>)}</ol>
            <SectionTools className="mt-3" prompt={repertorySpec(result.rubrics.map((r) => ({ path: r.path, weight: r.weight })), result.rows)} promptLabel="Research prompt: compare these remedies" />
          </div>
        )}
      </div>
    </div>
  );
}
