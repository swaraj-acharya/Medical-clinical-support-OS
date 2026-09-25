import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SafetyLevel } from "@/types/recommendation";
import type { SectionInfo } from "@/lib/content/section-info";
import type { PromptSpec } from "@/lib/prompts/build";
import { SectionTools } from "./section-tools";

export function PageHeader({ title, lead, actions, info, prompt, promptLabel }: { title: string; lead?: ReactNode; actions?: ReactNode; info?: SectionInfo; prompt?: PromptSpec; promptLabel?: string }) {
  return (
    <header className="mb-6 border-b border-hairline pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="prose-measure">
          <h1>{title}</h1>
          {lead && <p className="mt-1 text-ink-soft">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {(info || prompt) && <SectionTools info={info} prompt={prompt} promptLabel={promptLabel} infoLabel="About this page" className="mt-3" />}
    </header>
  );
}

/** Heading for a plain (non-collapsible) block, with its own info and research-prompt tools. */
export function BlockHeader({ title, info, prompt, promptLabel, id }: { title: string; info?: SectionInfo; prompt?: PromptSpec; promptLabel?: string; id?: string }) {
  return (
    <div className="mb-3">
      <h2 id={id}>{title}</h2>
      {(info || prompt) && <SectionTools info={info} prompt={prompt} promptLabel={promptLabel} className="mt-2" />}
    </div>
  );
}

const btn = {
  primary: "bg-ink text-white hover:bg-[#2b3d49]",
  secondary: "bg-panel text-ink border border-hairline hover:border-ink-faint",
  danger: "bg-danger text-white hover:bg-[#9a1d14]",
  quiet: "text-allo hover:bg-allo-wash",
};

export function buttonClass(variant: keyof typeof btn = "secondary", size: "sm" | "md" = "md") {
  return clsx("inline-flex items-center justify-center gap-1.5 rounded-[3px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", size === "sm" ? "px-2.5 py-1 text-sm" : "px-3.5 py-2 text-[0.95rem]", btn[variant]);
}

export function LinkButton({ href, children, variant = "secondary", size = "md" }: { href: string; children: ReactNode; variant?: keyof typeof btn; size?: "sm" | "md" }) {
  return <Link href={href} className={clsx(buttonClass(variant, size), "hover:no-underline")}>{children}</Link>;
}

export function Tag({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "allo" | "ayur" | "homeo" | "danger" | "caution" | "ok"; title?: string }) {
  const tones = {
    neutral: "bg-wash text-ink-soft", allo: "bg-allo-wash text-allo", ayur: "bg-ayur-wash text-ayur", homeo: "bg-homeo-wash text-homeo",
    danger: "bg-danger-wash text-danger", caution: "bg-caution-wash text-[#8a5a12]", ok: "bg-ok-wash text-ok",
  };
  return <span title={title} className={clsx("inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-[0.78rem] font-medium leading-tight", tones[tone])}>{children}</span>;
}

export const LEVEL_TONE: Record<SafetyLevel, "danger" | "caution" | "neutral" | "allo"> = {
  emergency: "danger", "high-risk": "danger", warning: "caution", interaction: "caution", review: "neutral", info: "neutral",
};
export const LEVEL_LABEL: Record<SafetyLevel, string> = {
  emergency: "Emergency", "high-risk": "High risk", warning: "Warning", interaction: "Interaction", review: "Review", info: "Info",
};

export function SafetyStatusTag({ status }: { status: "no-conflict-in-entered-data" | "caution" | "excluded" }) {
  if (status === "excluded") return <Tag tone="danger">Excluded by safety checks</Tag>;
  if (status === "caution") return <Tag tone="caution">Caution — review findings</Tag>;
  return <Tag tone="ok" title="No conflict found in the data entered. This is not a statement that the medicine is safe.">No conflict in entered data</Tag>;
}

export function Section({ id, title, summary, children, open = true, lane, info, prompt, promptLabel }: { id?: string; title: string; summary?: ReactNode; children: ReactNode; open?: boolean; lane?: "allopathy" | "ayurveda" | "homeopathy"; info?: SectionInfo; prompt?: PromptSpec; promptLabel?: string }) {
  return (
    <details id={id} open={open} className={clsx("sect mb-4 rounded-[3px] border border-hairline bg-panel", lane && `lane lane-${lane}`)}>
      <summary className="flex items-baseline gap-3 px-5 py-3.5">
        <span className="chev inline-block w-3 text-ink-faint" aria-hidden>›</span>
        <h2 className="text-[1.15rem]">{title}</h2>
        {summary && <span className="ml-auto text-sm text-ink-soft">{summary}</span>}
      </summary>
      <div className="border-t border-hairline px-5 py-4">
        {(info || prompt) && <SectionTools info={info} prompt={prompt} promptLabel={promptLabel} className="mb-4" />}
        {children}
      </div>
    </details>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-dashed border-hairline px-5 py-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,max-content)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-soft">{k}</dt>
          <dd>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export const SYSTEM_LABEL = { allopathy: "Allopathy", ayurveda: "Ayurveda", homeopathy: "Homeopathy" } as const;
export const SYSTEM_TONE = { allopathy: "allo", ayurveda: "ayur", homeopathy: "homeo" } as const;
