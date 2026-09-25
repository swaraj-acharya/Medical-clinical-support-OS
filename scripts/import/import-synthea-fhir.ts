/**
 * npm run import:synthea -- --file <bundle.json> [--create]
 * Converts a FHIR R4 Bundle (e.g., Synthea output — synthetic patients only) into a draft case. Conditions that do not
 * map to a known symptom concept are listed, never guessed. With --create, a complete draft is validated and saved.
 */
import { readFileSync } from "node:fs";
import { fhirBundleToCaseDraft } from "../../lib/fhir/fhir";
import { buildIndex } from "../../lib/knowledge/indexes";
import { getKnowledge } from "../../lib/knowledge/store";
import { createCaseAudited } from "../../lib/storage/service";
import { caseInputSchema } from "../../lib/validation/case-schema";
import { arg, flag } from "../lib/util";

async function main() {
  const file = arg("file");
  if (!file) { console.error("Usage: --file <bundle.json> [--create]"); process.exit(1); }
  const idx = buildIndex(getKnowledge());
  const { draft, unmapped } = fhirBundleToCaseDraft(JSON.parse(readFileSync(file, "utf8")), idx);
  console.log(JSON.stringify({ draft, unmapped }, null, 2));
  if (!flag("create")) return;
  const parsed = caseInputSchema.safeParse({ history: {}, systems: ["allopathy", "ayurveda", "homeopathy"], ...draft });
  if (!parsed.success) { console.error("Draft is incomplete for a case:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")); process.exit(1); }
  const rec = await createCaseAudited(parsed.data, "import:synthea");
  console.log(`Created ${rec.id}`);
}
main();
