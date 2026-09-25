"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

const ACTIONS = [["reviewed", "Reviewed"], ["accepted", "Accept"], ["modified", "Accept with modification"], ["rejected", "Reject"], ["chose-alternative", "Choose alternative"]] as const;

export function DecisionControl({ caseId, analysisId, candidateId, system, candidateName }: { caseId: string; analysisId: string; candidateId: string; system: string; candidateName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<string>("reviewed");
  const [reason, setReason] = useState("");
  const [alternative, setAlternative] = useState("");
  const [clinicianRef, setClinicianRef] = useState("");
  const [msg, setMsg] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>Record decision</button>;
  return (
    <form className="mt-2 space-y-2 rounded-[3px] border border-hairline bg-wash p-3 text-sm" onSubmit={async (e) => {
      e.preventDefault(); setMsg("");
      const res = await fetch(`/api/cases/${caseId}/decisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analysisId, candidateId, system, action, reason: reason || undefined, alternative: alternative || undefined, clinicianRef }) });
      const d = await res.json();
      if (!res.ok) { setMsg(d.issues ? d.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") : d.error); return; }
      setOpen(false); router.refresh();
    }}>
      <fieldset>
        <legend className="font-medium">Decision on {candidateName}</legend>
        <div className="mt-1 flex flex-wrap gap-3">{ACTIONS.map(([v, l]) => <label key={v} className="flex items-center gap-1.5"><input type="radio" name={`a-${candidateId}`} value={v} checked={action === v} onChange={() => setAction(v)} />{l}</label>)}</div>
      </fieldset>
      {action === "chose-alternative" && <label className="block">Alternative<input value={alternative} onChange={(e) => setAlternative(e.target.value)} required className="mt-1 w-full rounded-[3px] border border-hairline bg-panel px-2 py-1" /></label>}
      <label className="block">Reason {action === "rejected" || action === "chose-alternative" ? "(required)" : "(optional)"}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} required={action === "rejected" || action === "chose-alternative"} rows={2} className="mt-1 w-full rounded-[3px] border border-hairline bg-panel px-2 py-1" /></label>
      <label className="block">Clinician reference<input value={clinicianRef} onChange={(e) => setClinicianRef(e.target.value)} required placeholder="e.g. Dr-R-Mishra or staff ID" className="mt-1 w-full rounded-[3px] border border-hairline bg-panel px-2 py-1" /></label>
      {msg && <p role="alert" className="text-danger">{msg}</p>}
      <div className="flex gap-2"><button type="submit" className={buttonClass("primary", "sm")}>Save decision</button><button type="button" onClick={() => setOpen(false)} className={buttonClass("quiet", "sm")}>Cancel</button></div>
    </form>
  );
}

export function AcknowledgeForm({ caseId, rules }: { caseId: string; rules: { id: string; title: string }[] }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [clinicianRef, setClinicianRef] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="mt-4 space-y-3 border-t border-[#e7c98f] pt-4 text-sm" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg("");
      const res = await fetch(`/api/cases/${caseId}/acknowledge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acknowledgedRuleIds: checked, clinicianRef, reason }) });
      const d = await res.json();
      if (!res.ok) { setMsg(d.issues ? d.issues.map((i: { message: string }) => i.message).join("; ") : d.error); setBusy(false); return; }
      router.push(`/analysis/${d.analysisId}`);
    }}>
      <p className="font-medium">To see candidates, confirm that each urgent red flag has been clinically assessed. This is recorded in the audit log with your reason.</p>
      {rules.map((r) => <label key={r.id} className="flex items-center gap-2"><input type="checkbox" checked={checked.includes(r.id)} onChange={(e) => setChecked(e.target.checked ? [...checked, r.id] : checked.filter((x) => x !== r.id))} />I have assessed: {r.title}</label>)}
      <label className="block">Assessment and reason for continuing (required)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} rows={2} className="mt-1 w-full rounded-[3px] border border-hairline bg-panel px-2 py-1" /></label>
      <label className="block">Clinician reference<input value={clinicianRef} onChange={(e) => setClinicianRef(e.target.value)} required className="mt-1 w-full max-w-xs rounded-[3px] border border-hairline bg-panel px-2 py-1" /></label>
      {msg && <p role="alert" className="text-danger">{msg}</p>}
      <button type="submit" disabled={busy || checked.length !== rules.length} className={buttonClass("primary", "sm")}>{busy ? "Recording…" : "Record assessment and show candidates"}</button>
    </form>
  );
}
