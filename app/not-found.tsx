import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="prose-measure py-16">
      <h1>Not found</h1>
      <p className="mt-2 text-ink-soft">The case, analysis or reference entry does not exist, or the identifier is not valid.</p>
      <div className="mt-6"><LinkButton href="/">Back to dashboard</LinkButton></div>
    </div>
  );
}
