import { CaseForm, type FormOptions } from "@/components/case-form";
import { PageHeader } from "@/components/ui";
import { INFO } from "@/lib/content/section-info";
import { getKnowledge } from "@/lib/knowledge/store";

export const metadata = { title: "New case" };

export default function NewCasePage() {
  const kb = getKnowledge();
  const options: FormOptions = {
    symptoms: kb.symptoms.map((s) => ({ id: s.id, label: s.label, bodySystem: s.bodySystem, terms: [...s.synonyms, ...s.ayurvedaTerms, ...kb.ayurvedicIndications.filter((t) => t.symptomIds.includes(s.id)).flatMap((t) => [t.term, ...t.variants])], redFlag: Boolean(s.redFlagConcept) })),
    conditions: kb.historyConditions.map((c) => ({ id: c.id, label: c.label })),
    flags: kb.redFlagChecklist,
    medicineNames: [...new Set(kb.drugs.flatMap((d) => [d.name, ...d.brandMappings.map((b) => b.brand)]))].sort(),
  };
  return (
    <div>
      <PageHeader title="New case" info={INFO.newCase} lead="Eight short steps. Only the patient, one presenting symptom and at least one system are required; everything else improves the safety checks." />
      <CaseForm options={options} />
    </div>
  );
}
