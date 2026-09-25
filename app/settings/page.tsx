import { KV, PageHeader, Tag } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { authMode } from "@/lib/auth/session";
import { runtimeDir } from "@/lib/storage/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const mode = authMode();
  const ai = process.env.CDS_AI_MODE === "extract";
  return (
    <div>
      <PageHeader title="Settings" info={INFO.settings} lead="Configuration is read from environment variables at start-up (see .env.example). This page shows the current values; secrets are never displayed." />
      <div className="prose-measure space-y-8">
        <section>
          <h2 className="mb-2">Access control</h2>
          <KV items={[["Mode", mode === "enabled" ? <Tag key="m" tone="ok">Enabled — shared access token + signed session cookie</Tag> : mode === "disabled-dev" ? <Tag key="m" tone="caution">Off (development only)</Tag> : <Tag key="m" tone="danger">Misconfigured — requests are refused</Tag>], ["Session length", "8 hours"], ["Cookie", "HttpOnly, SameSite=Strict, Secure in production"]]} />
          {mode === "enabled" && <form action="/api/auth/logout" method="post" className="mt-3"><button className="rounded-[3px] border border-hairline bg-panel px-3 py-1.5 text-sm">Sign out</button></form>}
        </section>
        <section>
          <h2 className="mb-2">Analysis mode</h2>
          <KV items={[["Recommendation engine", "Deterministic (rules, context matching, repertorization). Always on."], ["AI-assisted extraction", ai ? (process.env.CDS_AI_ALLOW_CLINICAL_TEXT === "true" ? <Tag key="a" tone="caution">On — free text is de-identified and sent to the configured model for concept mapping only</Tag> : <Tag key="a">Configured but clinical text not permitted (CDS_AI_ALLOW_CLINICAL_TEXT)</Tag>) : "Off — lexicon matching only"], ["Model key present", process.env.ANTHROPIC_API_KEY ? "yes" : "no"]]} />
          <p className="mt-2 text-sm text-ink-soft">An LLM is never used to generate, rank or dose candidates. Extracted concept IDs are validated against the knowledge base.</p>
        </section>
        <section>
          <h2 className="mb-2">Storage and privacy</h2>
          <KV items={[["Runtime data directory", <code key="d" className="text-xs">{runtimeDir()}</code>], ["Demo seeding", process.env.CDS_DISABLE_DEMO === "true" ? "disabled" : "enabled"], ["Server logs", "event names and IDs only — clinical text is redacted"]]} />
          <p className="mt-2 text-sm text-ink-soft">Use pseudonymous patient references. Before any real-patient use, complete a data-protection review (DPDP Act 2023) and clinical-governance sign-off — see SECURITY.md and MEDICAL_SAFETY.md.</p>
        </section>
      </div>
    </div>
  );
}
