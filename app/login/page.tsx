"use client";
import { useState } from "react";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1>Sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">Enter the clinic access token. Sessions last 8 hours.</p>
      <form className="mt-6 space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
        if (res.ok) { window.location.href = "/"; return; }
        setErr((await res.json().catch(() => ({}))).error ?? "Sign-in failed"); setBusy(false);
      }}>
        <label htmlFor="tok" className="block text-sm font-medium">Access token</label>
        <input id="tok" type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} required className="w-full rounded-[3px] border border-hairline bg-panel px-3 py-2" />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button disabled={busy} className="w-full rounded-[3px] bg-ink px-4 py-2 text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
