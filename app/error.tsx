"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="prose-measure py-16">
      <h1>Something failed while loading this page</h1>
      <p className="mt-2 text-ink-soft">No clinical output was produced. Reference: {error.digest ?? "n/a"}. If the knowledge base is missing, run <code>npm run knowledge:build</code>.</p>
      <button onClick={reset} className="mt-6 rounded-[3px] border border-hairline bg-panel px-3.5 py-2">Try again</button>
    </div>
  );
}
