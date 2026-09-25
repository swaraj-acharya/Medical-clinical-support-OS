"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function SeedDemoButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button className={buttonClass("secondary")} disabled={state === "busy"} onClick={async () => {
        setState("busy");
        try {
          const r = await post("/api/demo/seed");
          const n = r.results.filter((x: { created: boolean }) => x.created).length;
          setMsg(n ? `Loaded ${n} demo case${n > 1 ? "s" : ""}.` : "Demo cases already loaded.");
          setState("done");
          router.refresh();
        } catch (e) { setMsg((e as Error).message); setState("error"); }
      }}>{state === "busy" ? "Loading demo cases…" : "Load demo cases"}</button>
      {msg && <span role="status" className={state === "error" ? "text-sm text-danger" : "text-sm text-ink-soft"}>{msg}</span>}
    </span>
  );
}

export function RunAnalysisButton({ caseId, label = "Run analysis" }: { caseId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button className={buttonClass("primary")} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { const r = await post(`/api/cases/${caseId}/analyze`); router.push(`/analysis/${r.analysisId}`); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
      }}>{busy ? "Analysing…" : label}</button>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </span>
  );
}

export function ReloadKnowledgeButton() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button className={buttonClass("secondary", "sm")} onClick={async () => {
        try { const r = await post("/api/knowledge/reload"); setMsg(`Reloaded v${r.version}`); router.refresh(); } catch (e) { setMsg((e as Error).message); }
      }}>Reload knowledge base</button>
      {msg && <span role="status" className="text-sm text-ink-soft">{msg}</span>}
    </span>
  );
}

export { post };
