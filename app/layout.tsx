import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/source-serif-4/600.css";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { authMode } from "@/lib/auth/session";
import { getKnowledge } from "@/lib/knowledge/store";

export const metadata: Metadata = {
  title: { default: "Clinical Decision Support", template: "%s · Clinical Decision Support" },
  description: "Source-grounded clinical decision support for Allopathy, Ayurveda and Homeopathy. For qualified clinicians.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  let kb: { version: string; hash: string } | null = null;
  try { const m = getKnowledge().metadata; kb = { version: m.version, hash: m.contentHash.slice(0, 10) }; } catch { kb = null; }
  const mode = authMode();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-panel focus:px-3 focus:py-2">Skip to content</a>
        <div className="border-b border-hairline bg-ink px-4 py-1.5 text-center text-[0.82rem] text-white">
          Decision support for qualified clinicians. Every candidate needs clinician review — this tool does not diagnose or prescribe.
        </div>
        {mode === "disabled-dev" && (
          <div role="status" className="border-b border-caution/40 bg-caution-wash px-4 py-1.5 text-center text-[0.82rem] text-[#7a4f10]">
            Access control is off (development mode). Use synthetic data only. Set CDS_ACCESS_TOKEN before any real use.
          </div>
        )}
        <div className="mx-auto flex max-w-[1500px]">
          <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-hairline px-3 py-5 lg:flex">
            <div>
              <Link href="/" className="mb-6 block px-3 hover:no-underline">
                <span className="block font-serif text-[1.15rem] font-semibold leading-tight text-ink">Clinical Decision Support</span>
                <span className="text-xs text-ink-soft">Allopathy · Ayurveda · Homeopathy</span>
              </Link>
              <Nav />
            </div>
            <div className="px-3 text-xs text-ink-soft">
              {kb ? <>Knowledge base v{kb.version}<br /><span className="num">#{kb.hash}</span></> : <span className="text-danger">Knowledge base missing</span>}
              <br />Deterministic Mode{process.env.CDS_AI_MODE === "extract" ? " + AI extraction" : ""}
            </div>
          </aside>
          <main id="main" className="min-w-0 flex-1 px-5 py-6 lg:px-10">
            <div className="mb-4 lg:hidden"><details><summary className="cursor-pointer text-sm font-medium">Menu</summary><div className="mt-3"><Nav /></div></details></div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
