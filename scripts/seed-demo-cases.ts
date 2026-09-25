/** npm run seed:demo — creates the fictional demo cases and runs an analysis for each (audit-logged). */
import { seedDemoCases } from "../lib/demo/seed";

seedDemoCases("seed-script").then((r) => {
  for (const x of r) console.log(`${x.created ? "created" : "exists "} ${x.caseId}  ${x.key}${x.analysisId ? `  → ${x.analysisId}` : ""}`);
});
