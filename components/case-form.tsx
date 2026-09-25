"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useFieldArray, useForm, type FieldErrors, type Path } from "react-hook-form";
import {
  caseInputSchema, DURATION_UNIT, IMPAIRMENT, LATERALITY, ONSET, PREGNANCY, SEVERITY, SEX, type CaseInput, type CaseInputRaw,
} from "@/lib/validation/case-schema";
import { INFO } from "@/lib/content/section-info";
import { termSpec } from "@/lib/prompts/specs";
import { RepertorySelector, type SelectedRubric } from "./repertory-selector";
import { SectionTools } from "./section-tools";
import { buttonClass } from "./ui";

export interface FormOptions {
  symptoms: { id: string; label: string; bodySystem: string; terms: string[]; redFlag: boolean }[];
  conditions: { id: string; label: string }[];
  flags: { id: string; label: string; appliesTo: string[] }[];
  medicineNames: string[];
}

const STEPS = ["Patient", "Safety background", "Current medicines", "Presenting complaint", "Associated symptoms & red flags", "Vitals & labs", "Systems & assessment", "Review & save"] as const;
const STEP_FIELDS: Path<CaseInputRaw>[][] = [
  ["patient.patientRef", "patient.ageYears", "patient.sex", "patient.pregnancyStatus", "patient.gestationalWeeks", "patient.breastfeeding", "patient.heightCm", "patient.weightKg"],
  ["patient.allergies", "patient.renalImpairment", "patient.hepaticImpairment", "history.chronicConditions"],
  ["medications"],
  ["complaint.symptoms", "complaint.chiefComplaintId", "complaint.freeText"],
  ["complaint.associatedSymptomIds", "complaint.redFlagChecks"],
  ["vitals", "labs"],
  ["systems", "ayurveda", "homeopathy"],
  ["caseNotes"],
];

const STEP_INFO = [INFO.stepPatient, INFO.stepSafety, INFO.stepMedicines, INFO.stepComplaint, INFO.stepRedFlags, INFO.stepVitals, INFO.stepSystems, INFO.stepReview];

const num = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v)) };
const opt = { setValueAs: (v: unknown) => (v === "" ? undefined : v) };
const list = { setValueAs: (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean)) };

function errAt(errors: FieldErrors<CaseInputRaw>, path: string): string | undefined {
  let cur: unknown = errors;
  for (const k of path.split(".")) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[k] : undefined;
  return (cur as { message?: string } | undefined)?.message;
}

const inputCls = "mt-1 w-full rounded-[3px] border border-hairline bg-panel px-2.5 py-1.5 aria-[invalid=true]:border-danger";

function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor?: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      {error && <p role="alert" className="mt-0.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

function norm(s: string) { return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }

function SymptomPicker({ options, exclude, onPick, label, id }: { options: FormOptions["symptoms"]; exclude: string[]; onPick: (id: string) => void; label: string; id: string }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return [];
    return options.filter((o) => !exclude.includes(o.id)).map((o) => {
      const hit = [o.label, ...o.terms].find((t) => norm(t).includes(n));
      return hit ? { o, hit } : null;
    }).filter(Boolean).slice(0, 8) as { o: FormOptions["symptoms"][number]; hit: string }[];
  }, [q, options, exclude]);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a symptom — English, Hinglish (e.g. sar dard, bukhar) or Ayurvedic term" className={inputCls} autoComplete="off" />
      {norm(q).length >= 3 && matches.length === 0 && (
        <div className="mt-2 rounded-[3px] border border-dashed border-hairline px-3 py-2 text-sm">
          <p>“{q}” is not in the symptom list. Record it in the case notes, and research it if needed:</p>
          <SectionTools className="mt-2" prompt={termSpec(q, { hint: "condition" })} promptLabel={`Research prompt for “${q}”`} />
        </div>
      )}
      {matches.length > 0 && (
        <ul className="mt-1 divide-y divide-hairline rounded-[3px] border border-hairline bg-panel">
          {matches.map(({ o, hit }) => (
            <li key={o.id}>
              <button type="button" onClick={() => { onPick(o.id); setQ(""); }} className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-wash">
                <span className="font-medium">{o.label}</span>
                {norm(hit) !== norm(o.label) && <span className="text-ink-soft">matched “{hit}”</span>}
                {o.redFlag && <span className="ml-auto text-xs text-danger">red-flag symptom</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CaseForm({ options }: { options: FormOptions }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [extract, setExtract] = useState<{ symptoms: { conceptId: string; label: string; matchedTerm: string; matchType: string }[]; notes: string[] } | null>(null);
  const symLabel = useMemo(() => new Map(options.symptoms.map((s) => [s.id, s.label])), [options.symptoms]);

  const form = useForm<CaseInputRaw, unknown, CaseInput>({
    resolver: zodResolver(caseInputSchema),
    mode: "onBlur",
    defaultValues: {
      patient: { patientRef: "", sex: "unknown", pregnancyStatus: "unknown", breastfeeding: "unknown", allergies: [], renalImpairment: "unknown", hepaticImpairment: "unknown" },
      history: { chronicConditions: [], surgeries: [], pastIllnesses: [], familyHistory: [] },
      medications: [], vitals: {}, labs: {}, clinicalAssertions: [],
      complaint: { chiefComplaintId: "", symptoms: [], associatedSymptomIds: [], redFlagChecks: [] },
      ayurveda: { doshaObservations: [], agni: "not-assessed", ama: "not-assessed" },
      homeopathy: { rubrics: [] },
      systems: ["allopathy", "ayurveda", "homeopathy"],
    },
  });
  const { register, control, watch, setValue, getValues, trigger, handleSubmit, formState: { errors } } = form;
  const allergies = useFieldArray({ control, name: "patient.allergies" });
  const meds = useFieldArray({ control, name: "medications" });
  const syms = useFieldArray({ control, name: "complaint.symptoms" });

  const sex = watch("patient.sex");
  const preg = watch("patient.pregnancyStatus");
  const systems = watch("systems") ?? [];
  const symptomIds = watch("complaint.symptoms")?.map((s) => s.conceptId) ?? [];
  const assoc = watch("complaint.associatedSymptomIds") ?? [];
  const present = [...symptomIds, ...assoc];
  const relevantFlags = options.flags.filter((f) => f.appliesTo.some((s) => present.includes(s)));
  const [allFlags, setAllFlags] = useState(false);

  const addSymptom = (id: string) => {
    if (symptomIds.includes(id)) return;
    syms.append({ conceptId: id, triggers: [], aggravating: [], relieving: [] });
    if (!getValues("complaint.chiefComplaintId")) setValue("complaint.chiefComplaintId", id, { shouldValidate: true });
  };

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true); setSubmitError("");
    try {
      const res = await fetch("/api/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.issues ? body.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ") : body.error);
      const an = await fetch(`/api/cases/${body.id}/analyze`, { method: "POST" });
      const ab = await an.json();
      router.push(an.ok ? `/analysis/${ab.analysisId}` : `/cases/${body.id}`);
    } catch (e) { setSubmitError((e as Error).message); setSaving(false); }
  }, (errs) => { setSubmitError(`Some fields need attention: ${Object.keys(errs).join(", ")}. Go back to the highlighted step.`); });

  const runExtract = async () => {
    const text = getValues("complaint.freeText") ?? "";
    if (text.trim().length < 3) return;
    const res = await fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    if (res.ok) setExtract(await res.json());
  };

  const v = getValues();
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <ol aria-label="Case steps" className="space-y-0.5 text-sm">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={async () => { if (i < step || (await trigger(STEP_FIELDS[step]))) setStep(i); }} aria-current={i === step ? "step" : undefined}
              className={clsx("flex w-full items-baseline gap-2 rounded-[3px] px-2.5 py-1.5 text-left", i === step ? "bg-ink text-white" : i < step ? "text-ink hover:bg-wash" : "text-ink-soft hover:bg-wash")}>
              <span className="num w-4 text-right">{i + 1}</span><span>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="min-w-0">
        <h2 className="mb-1">{STEPS[step]}</h2>
        <SectionTools key={step} info={STEP_INFO[step]} infoLabel="About this step" className="mb-2" />
        <p className="mb-5 text-sm text-ink-soft">Use a pseudonymous patient reference — never a name, phone number or Aadhaar number.</p>

        <div className={clsx(step !== 0 && "hidden", "grid gap-4 sm:grid-cols-2")}>
          <Field label="Patient reference" htmlFor="pref" error={errAt(errors, "patient.patientRef")} hint="Letters, digits and hyphens, e.g. OPD-2026-0142"><input id="pref" {...register("patient.patientRef")} className={inputCls} aria-invalid={!!errAt(errors, "patient.patientRef")} /></Field>
          <Field label="Age (years)" htmlFor="age" error={errAt(errors, "patient.ageYears")} hint="Use decimals for infants (0.5 = 6 months)"><input id="age" type="number" step="0.1" {...register("patient.ageYears", num)} className={inputCls} aria-invalid={!!errAt(errors, "patient.ageYears")} /></Field>
          <Field label="Sex" htmlFor="sex"><select id="sex" {...register("patient.sex")} className={inputCls}>{SEX.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
          {sex !== "male" && <Field label="Pregnancy status" htmlFor="preg"><select id="preg" {...register("patient.pregnancyStatus")} className={inputCls}>{PREGNANCY.map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}</select></Field>}
          {preg === "pregnant" && <Field label="Gestational age (weeks)" htmlFor="gw" error={errAt(errors, "patient.gestationalWeeks")}><input id="gw" type="number" {...register("patient.gestationalWeeks", num)} className={inputCls} /></Field>}
          <Field label="Breastfeeding" htmlFor="bf"><select id="bf" {...register("patient.breastfeeding")} className={inputCls}>{["unknown", "yes", "no", "not-applicable"].map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}</select></Field>
          <Field label="Height (cm)" htmlFor="ht"><input id="ht" type="number" {...register("patient.heightCm", num)} className={inputCls} /></Field>
          <Field label="Weight (kg)" htmlFor="wt"><input id="wt" type="number" step="0.1" {...register("patient.weightKg", num)} className={inputCls} /></Field>
        </div>

        <div className={clsx(step !== 1 && "hidden", "space-y-6")}>
          <fieldset>
            <legend className="text-sm font-medium">Allergies and intolerances</legend>
            <div className="mt-2 space-y-2">
              {allergies.fields.map((f, i) => (
                <div key={f.id} className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]">
                  <input aria-label="Substance" placeholder="Substance, e.g. penicillin, ibuprofen, sulfa" {...register(`patient.allergies.${i}.substance`)} className={inputCls} />
                  <input aria-label="Reaction" placeholder="Reaction" {...register(`patient.allergies.${i}.reaction`, opt)} className={inputCls} />
                  <select aria-label="Severity" {...register(`patient.allergies.${i}.severity`)} className={inputCls}>{["unknown", "mild", "moderate", "severe"].map((s) => <option key={s}>{s}</option>)}</select>
                  <button type="button" onClick={() => allergies.remove(i)} className={buttonClass("quiet", "sm")}>Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => allergies.append({ substance: "", severity: "unknown" })} className={buttonClass("secondary", "sm")}>Add allergy</button>
              {allergies.fields.length === 0 && <p className="text-xs text-ink-soft">No allergies entered. Record “no known drug allergies” in the case notes if confirmed.</p>}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Renal impairment" htmlFor="renal"><select id="renal" {...register("patient.renalImpairment")} className={inputCls}>{IMPAIRMENT.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Hepatic impairment" htmlFor="hep"><select id="hep" {...register("patient.hepaticImpairment")} className={inputCls}>{IMPAIRMENT.map((s) => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Chronic conditions relevant to medicine safety</legend>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {options.conditions.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" value={c.id} {...register("history.chronicConditions")} />{c.label}</label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Clinical assertions</legend>
            <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" value="dengue-excluded" {...register("clinicalAssertions")} />Dengue has been excluded (lifts the India-first NSAID/aspirin restriction in fever)</label>
          </fieldset>
        </div>

        <div className={clsx(step !== 2 && "hidden", "space-y-2")}>
          <datalist id="medicine-names">{options.medicineNames.map((n) => <option key={n} value={n} />)}</datalist>
          {meds.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input aria-label="Medicine" list="medicine-names" placeholder="Generic or brand, e.g. Combiflam, Pan 40, warfarin" {...register(`medications.${i}.name`)} className={inputCls} />
              <input aria-label="Strength" placeholder="Strength" {...register(`medications.${i}.strength`, opt)} className={inputCls} />
              <input aria-label="Frequency" placeholder="Frequency" {...register(`medications.${i}.frequency`, opt)} className={inputCls} />
              <button type="button" onClick={() => meds.remove(i)} className={buttonClass("quiet", "sm")}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => meds.append({ name: "" })} className={buttonClass("secondary", "sm")}>Add medicine</button>
          <p className="text-xs text-ink-soft">Brands and fixed-dose combinations are resolved to their ingredients for interaction and duplicate-therapy checks. Anything not recognised is flagged in the analysis.</p>
        </div>

        <div className={clsx(step !== 3 && "hidden", "space-y-5")}>
          <Field label="Complaint in the clinician's words (optional)" htmlFor="ft" hint="Used only to suggest symptom concepts. No identifiers.">
            <textarea id="ft" rows={3} {...register("complaint.freeText", opt)} className={inputCls} />
          </Field>
          <div>
            <button type="button" onClick={runExtract} className={buttonClass("secondary", "sm")}>Suggest symptoms from text</button>
            {extract && (
              <div className="mt-2 text-sm">
                {extract.symptoms.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {extract.symptoms.map((s) => (
                      <li key={s.conceptId}><button type="button" onClick={() => addSymptom(s.conceptId)} disabled={symptomIds.includes(s.conceptId)} className={buttonClass("secondary", "sm")}>
                        {symptomIds.includes(s.conceptId) ? "✓ " : "Add "}{s.label} <span className="text-ink-soft">({s.matchType}: “{s.matchedTerm}”)</span></button></li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 text-xs text-ink-soft">{extract.notes.join(" ")}</p>
              </div>
            )}
          </div>
          <SymptomPicker id="sym-add" label="Add a presenting symptom" options={options.symptoms} exclude={present} onPick={addSymptom} />
          {errAt(errors, "complaint.symptoms") && <p role="alert" className="text-sm text-danger">Add at least one presenting symptom.</p>}
          {syms.fields.map((f, i) => (
            <fieldset key={f.id} className="rounded-[3px] border border-hairline bg-panel p-4">
              <legend className="px-1 font-medium">{symLabel.get(f.conceptId) ?? f.conceptId}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Location"><input {...register(`complaint.symptoms.${i}.location`, opt)} className={inputCls} placeholder="e.g. temples, epigastrium" /></Field>
                <Field label="Side"><select {...register(`complaint.symptoms.${i}.laterality`, opt)} className={inputCls}><option value="">—</option>{LATERALITY.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Character"><input {...register(`complaint.symptoms.${i}.sensation`, opt)} className={inputCls} placeholder="throbbing, pressing, burning…" /></Field>
                <Field label="Severity"><select {...register(`complaint.symptoms.${i}.severity`, opt)} className={inputCls}><option value="">—</option>{SEVERITY.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Onset"><select {...register(`complaint.symptoms.${i}.onset`, opt)} className={inputCls}><option value="">—</option>{ONSET.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Duration"><input type="number" step="0.5" {...register(`complaint.symptoms.${i}.durationValue`, num)} className={inputCls} /></Field>
                  <Field label="Unit"><select {...register(`complaint.symptoms.${i}.durationUnit`, opt)} className={inputCls}><option value="">—</option>{DURATION_UNIT.map((s) => <option key={s}>{s}</option>)}</select></Field>
                </div>
                <Field label="Worse with (comma-separated)"><input {...register(`complaint.symptoms.${i}.aggravating`, list)} className={inputCls} placeholder="sun, motion, lying down" /></Field>
                <Field label="Better with"><input {...register(`complaint.symptoms.${i}.relieving`, list)} className={inputCls} placeholder="pressure, rest, cold" /></Field>
                <Field label="Triggers"><input {...register(`complaint.symptoms.${i}.triggers`, list)} className={inputCls} placeholder="spicy food, stress" /></Field>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" value={f.conceptId} {...register("complaint.chiefComplaintId")} />Chief complaint</label>
                <button type="button" onClick={() => syms.remove(i)} className="text-danger hover:underline">Remove symptom</button>
              </div>
            </fieldset>
          ))}
        </div>

        <div className={clsx(step !== 4 && "hidden", "space-y-6")}>
          <div>
            <SymptomPicker id="assoc-add" label="Add an associated symptom" options={options.symptoms} exclude={present} onPick={(id) => setValue("complaint.associatedSymptomIds", [...assoc, id])} />
            <ul className="mt-2 flex flex-wrap gap-2">
              {assoc.map((id) => <li key={id}><button type="button" onClick={() => setValue("complaint.associatedSymptomIds", assoc.filter((x) => x !== id))} className={buttonClass("secondary", "sm")} aria-label={`Remove ${symLabel.get(id)}`}>{symLabel.get(id) ?? id} ✕</button></li>)}
            </ul>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Red-flag checklist</legend>
            <p className="text-xs text-ink-soft">Tick only what is present. The safety engine runs first and can block candidate generation.</p>
            <div className="mt-2 space-y-1">
              {(allFlags ? options.flags : relevantFlags).map((f) => <label key={f.id} className="flex items-start gap-2 text-sm"><input type="checkbox" value={f.id} {...register("complaint.redFlagChecks")} className="mt-1" />{f.label}</label>)}
              {!allFlags && relevantFlags.length === 0 && <p className="text-sm text-ink-soft">No checklist items are specific to the symptoms entered so far.</p>}
            </div>
            <button type="button" onClick={() => setAllFlags(!allFlags)} className="mt-2 text-sm text-allo hover:underline">{allFlags ? "Show only relevant items" : `Show all ${options.flags.length} checklist items`}</button>
          </fieldset>
        </div>

        <div className={clsx(step !== 5 && "hidden", "grid gap-4 sm:grid-cols-3")}>
          {([["vitals.temperatureC", "Temperature (°C)", "0.1"], ["vitals.heartRate", "Heart rate (/min)", "1"], ["vitals.respiratoryRate", "Respiratory rate (/min)", "1"], ["vitals.systolicBP", "Systolic BP (mmHg)", "1"], ["vitals.diastolicBP", "Diastolic BP (mmHg)", "1"], ["vitals.spo2", "SpO₂ (%)", "1"], ["vitals.gcs", "GCS (3–15)", "1"],
            ["labs.egfr", "eGFR (mL/min/1.73m²)", "1"], ["labs.alt", "ALT (U/L)", "1"], ["labs.haemoglobin", "Haemoglobin (g/dL)", "0.1"], ["labs.platelets", "Platelets (×10⁹/L)", "1"], ["labs.inr", "INR", "0.1"]] as const).map(([name, label, stepv]) => (
            <Field key={name} label={label} htmlFor={name} error={errAt(errors, name)}><input id={name} type="number" step={stepv} {...register(name, num)} className={inputCls} aria-invalid={!!errAt(errors, name)} /></Field>
          ))}
          <p className="text-xs text-ink-soft sm:col-span-3">Missing vitals are not assumed normal: rules that need them are reported as not fully evaluated.</p>
        </div>

        <div className={clsx(step !== 6 && "hidden", "space-y-6")}>
          <fieldset>
            <legend className="text-sm font-medium">Systems to consult</legend>
            <div className="mt-1 flex flex-wrap gap-4">{(["allopathy", "ayurveda", "homeopathy"] as const).map((s) => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" value={s} {...register("systems")} />{s[0].toUpperCase() + s.slice(1)}</label>)}</div>
            {errAt(errors, "systems") && <p role="alert" className="text-xs text-danger">Choose at least one system.</p>}
          </fieldset>
          {systems.includes("ayurveda") && (
            <fieldset className="lane lane-ayurveda bg-panel py-3 pl-4 pr-3">
              <legend className="sr-only">Ayurvedic assessment</legend>
              <h3>Ayurvedic assessment</h3>
              <p className="text-xs text-ink-soft">Clinician's traditional assessment. It changes how items are marked (supporting / review) — it is not a validated diagnostic test.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["vata-vriddhi", "pitta-vriddhi", "kapha-vriddhi", "vata-kshaya", "pitta-kshaya", "kapha-kshaya"] as const).map((d) => <label key={d} className="flex items-center gap-2 text-sm"><input type="checkbox" value={d} {...register("ayurveda.doshaObservations")} />{d}</label>)}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Agni"><select {...register("ayurveda.agni")} className={inputCls}>{["not-assessed", "sama", "vishama", "tikshna", "manda"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Ama"><select {...register("ayurveda.ama")} className={inputCls}>{["not-assessed", "present", "absent"].map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Prakriti note"><input {...register("ayurveda.prakritiNote", opt)} className={inputCls} /></Field>
                <Field label="Assessment note"><input {...register("ayurveda.assessmentNote", opt)} className={inputCls} /></Field>
              </div>
            </fieldset>
          )}
          {systems.includes("homeopathy") && (
            <div className="lane lane-homeopathy bg-panel py-3 pl-4 pr-3">
              <h3>Repertory rubrics</h3>
              <p className="mb-3 text-xs text-ink-soft">Optional. If you choose none, rubrics are auto-suggested from the structured symptom details and clearly labelled as provisional.</p>
              <RepertorySelector value={(getValues("homeopathy.rubrics") ?? []) as SelectedRubric[]} onChange={(r) => setValue("homeopathy.rubrics", r)} showRepertorize={false} />
            </div>
          )}
        </div>

        <div className={clsx(step !== 7 && "hidden", "space-y-4")}>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="text-ink-soft">Patient</dt><dd>{v.patient?.patientRef || "—"} · {String(v.patient?.ageYears ?? "?")} y · {v.patient?.sex}{v.patient?.pregnancyStatus === "pregnant" ? ` · pregnant ${v.patient?.gestationalWeeks ?? "?"} w` : ""}</dd>
            <dt className="text-ink-soft">Allergies</dt><dd>{v.patient?.allergies?.map((a) => a.substance).filter(Boolean).join(", ") || "none entered"}</dd>
            <dt className="text-ink-soft">Current medicines</dt><dd>{v.medications?.map((m) => m.name).filter(Boolean).join(", ") || "none entered"}</dd>
            <dt className="text-ink-soft">Presenting symptoms</dt><dd>{symptomIds.map((id) => symLabel.get(id)).join(", ") || "none"}</dd>
            <dt className="text-ink-soft">Associated</dt><dd>{assoc.map((id) => symLabel.get(id)).join(", ") || "none"}</dd>
            <dt className="text-ink-soft">Red-flag items ticked</dt><dd>{v.complaint?.redFlagChecks?.length ?? 0}</dd>
            <dt className="text-ink-soft">Systems</dt><dd>{systems.join(", ")}</dd>
          </dl>
          <Field label="Case notes (optional)" htmlFor="notes"><textarea id="notes" rows={3} {...register("caseNotes", opt)} className={inputCls} /></Field>
          <p className="text-sm text-ink-soft">Saving runs the safety screen first, then each selected system separately. Results are candidates for your review, stored with the knowledge-base version and an audit entry.</p>
        </div>

        {submitError && <p role="alert" className="mt-4 rounded-[3px] bg-danger-wash px-3 py-2 text-sm text-danger">{submitError}</p>}
        <div className="mt-8 flex gap-2 border-t border-hairline pt-4">
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("secondary")}>Back</button>}
          {step < STEPS.length - 1 ? <button type="button" onClick={next} className={buttonClass("primary")}>Continue</button>
            : <button type="submit" disabled={saving} className={buttonClass("primary")}>{saving ? "Saving and analysing…" : "Save case and run analysis"}</button>}
        </div>
      </div>
    </form>
  );
}
