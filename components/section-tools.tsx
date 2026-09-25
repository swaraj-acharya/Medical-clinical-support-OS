"use client";
import clsx from "clsx";
import { BookOpenText, Check, Copy, Download, Info, RotateCcw } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { SectionInfo } from "@/lib/content/section-info";
import { buildPrompt, DEFAULT_PROMPT_OPTIONS, DEPTH_LABEL, type PromptDepth, type PromptOptions, type PromptSpec } from "@/lib/prompts/build";

const toggleCls = (on: boolean) =>
  clsx("inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-[0.82rem] font-medium transition-colors",
    on ? "border-ink bg-ink text-white" : "border-hairline bg-panel text-ink-soft hover:border-ink-faint hover:text-ink");

export function InfoBody({ info }: { info: SectionInfo }) {
  return (
    <dl className="prose-measure space-y-1.5 text-sm">
      <div><dt className="inline font-medium">What it shows. </dt><dd className="inline">{info.what}</dd></div>
      {info.how && <div><dt className="inline font-medium">How it works. </dt><dd className="inline">{info.how}</dd></div>}
      {info.data && <div><dt className="inline font-medium">Data used. </dt><dd className="inline">{info.data}</dd></div>}
      {info.limits && <div><dt className="inline font-medium">Keep in mind. </dt><dd className="inline">{info.limits}</dd></div>}
    </dl>
  );
}

/**
 * Per-section toolbar: “About this section” and “Research prompt”. Panels open below the toolbar, one at a time.
 */
export function SectionTools({ info, prompt, promptLabel = "Research prompt", infoLabel = "About this section", defaultOpen, className }: {
  info?: SectionInfo; prompt?: PromptSpec; promptLabel?: string; infoLabel?: string; defaultOpen?: "info" | "prompt"; className?: string;
}) {
  const [open, setOpen] = useState<"info" | "prompt" | null>(defaultOpen ?? null);
  const id = useId();
  if (!info && !prompt) return null;
  return (
    <div className={clsx("no-print", className)}>
      <div className="flex flex-wrap gap-2">
        {info && (
          <button type="button" aria-expanded={open === "info"} aria-controls={`${id}-info`} onClick={() => setOpen(open === "info" ? null : "info")} className={toggleCls(open === "info")}>
            <Info size={14} aria-hidden /> {infoLabel}
          </button>
        )}
        {prompt && (
          <button type="button" aria-expanded={open === "prompt"} aria-controls={`${id}-prompt`} onClick={() => setOpen(open === "prompt" ? null : "prompt")} className={toggleCls(open === "prompt")}>
            <BookOpenText size={14} aria-hidden /> {promptLabel}
          </button>
        )}
      </div>
      {open === "info" && info && <div id={`${id}-info`} className="mt-2 rounded-[3px] border border-hairline bg-wash px-4 py-3"><InfoBody info={info} /></div>}
      {open === "prompt" && prompt && <div id={`${id}-prompt`} className="mt-2"><PromptPanel spec={prompt} /></div>}
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "research-prompt";
}

export function PromptPanel({ spec }: { spec: PromptSpec }) {
  const [opts, setOpts] = useState<PromptOptions>(DEFAULT_PROMPT_OPTIONS);
  const generated = useMemo(() => buildPrompt(spec, opts), [spec, opts]);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const id = useId();
  const value = text ?? generated;
  const edited = text !== null && text !== generated;
  const words = value.trim().split(/\s+/).length;
  const set = (patch: Partial<PromptOptions>) => { setOpts({ ...opts, ...patch }); setText(null); setCopied(false); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.getElementById(`${id}-text`) as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(spec.title)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-[3px] border border-hairline bg-panel">
      <div className="border-b border-hairline px-4 py-3">
        <p className="font-medium">{spec.title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">Paste into any AI or deep-research tool. Tools that can search the web return the most reliable citations — check every reference before relying on it.</p>
      </div>
      <div className="grid gap-4 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <fieldset>
          <legend className="font-medium">Depth</legend>
          <div className="mt-1 space-y-1">
            {(Object.keys(DEPTH_LABEL) as PromptDepth[]).map((d) => (
              <label key={d} className="flex items-center gap-2"><input type="radio" name={`${id}-depth`} checked={opts.depth === d} onChange={() => set({ depth: d })} />{DEPTH_LABEL[d]}</label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="font-medium">Include</legend>
          <div className="mt-1 space-y-1">
            <label className={clsx("flex items-center gap-2", !spec.caseData?.length && "text-ink-faint")}><input type="checkbox" disabled={!spec.caseData?.length} checked={opts.includeCase && Boolean(spec.caseData?.length)} onChange={(e) => set({ includeCase: e.target.checked })} />De-identified case data</label>
            <label className={clsx("flex items-center gap-2", !spec.toolFindings?.length && "text-ink-faint")}><input type="checkbox" disabled={!spec.toolFindings?.length} checked={opts.includeFindings && Boolean(spec.toolFindings?.length)} onChange={(e) => set({ includeFindings: e.target.checked })} />What this tool found</label>
            <label className={clsx("flex items-center gap-2", !spec.caseFreeText && "text-ink-faint")}><input type="checkbox" disabled={!spec.caseFreeText} checked={opts.includeFreeText && Boolean(spec.caseFreeText)} onChange={(e) => set({ includeFreeText: e.target.checked })} />Clinician's free-text notes (scrubbed)</label>
            <label className="flex items-center gap-2">Guidance focus
              <select value={opts.jurisdiction} onChange={(e) => set({ jurisdiction: e.target.value as PromptOptions["jurisdiction"] })} className="rounded-[3px] border border-hairline bg-panel px-1.5 py-0.5">
                <option value="india">India first</option><option value="international">International</option>
              </select>
            </label>
          </div>
        </fieldset>
      </div>
      <div className="px-4">
        <label htmlFor={`${id}-text`} className="sr-only">Research prompt text</label>
        <textarea id={`${id}-text`} value={value} onChange={(e) => { setText(e.target.value); setCopied(false); }} rows={16} spellCheck={false}
          className="w-full resize-y rounded-[3px] border border-hairline bg-surface px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink" />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-2 text-sm">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-[3px] bg-ink px-3 py-1.5 font-medium text-white">
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Copied" : "Copy prompt"}
        </button>
        <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-[3px] border border-hairline bg-panel px-3 py-1.5"><Download size={14} aria-hidden /> Download .txt</button>
        {edited && <button type="button" onClick={() => setText(null)} className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-allo hover:bg-allo-wash"><RotateCcw size={14} aria-hidden /> Discard edits</button>}
        <span className="ml-auto text-xs text-ink-soft">{words.toLocaleString("en-IN")} words{edited ? " · edited" : ""}</span>
        <span role="status" aria-live="polite" className="sr-only">{copied ? "Prompt copied to clipboard" : ""}</span>
      </div>
      <p className="border-t border-hairline px-4 py-2 text-xs text-ink-soft">
        Privacy: the patient reference is never included, free text is excluded unless you opt in, and names, phone and ID numbers are scrubbed. Review the prompt before pasting it into an external service and follow your organisation's data-protection policy (DPDP Act 2023).
      </p>
    </div>
  );
}
