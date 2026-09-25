import { describe, expect, it } from "vitest";
import { matchContexts } from "../../lib/engines/context";
import { runAllopathy } from "../../lib/engines/allopathy";
import { caseAyurvedaTerms, runAyurveda } from "../../lib/engines/ayurveda";
import { runHomeopathy } from "../../lib/engines/homeopathy";
import { childrenOf, repertorize, searchRubrics, suggestRubrics } from "../../lib/engines/repertory";
import { followUpQuestions } from "../../lib/engines/followup";
import { evaluateRedFlags } from "../../lib/safety/red-flags";
import { idx, mkCase, stateOf } from "../helpers";

const i = idx();
const migraine = mkCase({ complaint: { symptoms: [{ conceptId: "sym_headache", laterality: "right", sensation: "throbbing", severity: "moderate", onset: "gradual", durationValue: 1, durationUnit: "days", triggers: [], aggravating: ["sun", "motion"], relieving: ["pressure"] }], associatedSymptomIds: ["sym_nausea"] } });

describe("clinical context matching", () => {
  it("qualifies tension-type features and scores context fit (not probability)", () => {
    const ctx = matchContexts(mkCase(), stateOf(mkCase(), i), i);
    const tth = ctx.find((c) => c.contextId === "ctx_tension_headache")!;
    expect(tth.qualifies).toBe(true);
    expect(tth.score).toBeGreaterThan(0.5);
    expect(tth.score).toBeLessThanOrEqual(1);
  });
  it("qualifies migraine features for unilateral throbbing headache with nausea", () => {
    const ctx = matchContexts(migraine, stateOf(migraine, i), i);
    expect(ctx[0].contextId).toBe("ctx_migraine");
    expect(ctx[0].qualifies).toBe(true);
  });
  it("reports unknown features instead of treating them as absent", () => {
    const c = mkCase({ complaint: { symptoms: [{ conceptId: "sym_headache", triggers: [], aggravating: [], relieving: [] }] } });
    const ctx = matchContexts(c, stateOf(c, i), i);
    expect(ctx.flatMap((x) => x.features).some((f) => f.status === "unknown")).toBe(true);
  });
});

describe("allopathy engine", () => {
  it("surfaces guideline-linked candidates with sources and a context metric", () => {
    const c = mkCase();
    const st = stateOf(c, i);
    const r = runAllopathy(st, i, matchContexts(c, st, i));
    expect(r.candidates.length).toBeGreaterThan(0);
    for (const cand of r.candidates) {
      expect(cand.sources.length).toBeGreaterThan(0);
      expect(cand.metric.label).toBe("Guideline / clinical context match");
      expect(cand.evidence[0].category).toBe("authoritative-guideline");
    }
    expect(r.advisories.some((a) => a.kind === "do-not-offer")).toBe(true); // e.g. opioids for TTH
  });
  it("returns an explicit not-found message when no context matches", () => {
    const c = mkCase({ complaint: { chiefComplaintId: "sym_back_pain", symptoms: [{ conceptId: "sym_back_pain", triggers: [], aggravating: [], relieving: [] }] } });
    const st = stateOf(c, i);
    const r = runAllopathy(st, i, matchContexts(c, st, i));
    expect(r.candidates).toHaveLength(0);
    expect(r.notFound[0]).toMatch(/No curated clinical context/);
  });
});

describe("ayurveda engine", () => {
  it("bridges symptoms to classical terms (with laterality qualifier)", () => {
    const terms = caseAyurvedaTerms(stateOf(migraine, i), i).map((t) => t.term);
    expect(terms).toContain("shirahshula");
    expect(terms).toContain("ardhavabhedaka");
    expect(caseAyurvedaTerms(stateOf(mkCase(), i), i).map((t) => t.term)).not.toContain("ardhavabhedaka");
  });
  it("matches classical indications and separates traditional rationale from modern evidence", () => {
    const c = mkCase({ complaint: { chiefComplaintId: "sym_heartburn", symptoms: [{ conceptId: "sym_heartburn", triggers: [], aggravating: [], relieving: [] }] }, ayurveda: { doshaObservations: ["pitta-vriddhi"], agni: "manda", ama: "present" } });
    const r = runAyurveda(c, stateOf(c, i), i);
    expect(r.candidates.length).toBeGreaterThan(0);
    const cats = r.candidates[0].evidence.map((e) => e.category);
    expect(cats).toEqual(expect.arrayContaining(["traditional-classical", "insufficient-evidence"]));
    expect(r.candidates.some((x) => x.metric.doshaSupport.length > 0)).toBe(true);
  });
  it("flags mineral/metal formulations and excludes them in pregnancy", () => {
    const base = { complaint: { chiefComplaintId: "sym_heartburn", symptoms: [{ conceptId: "sym_heartburn", triggers: [], aggravating: [], relieving: [] }] } };
    const normal = runAyurveda(mkCase(base), stateOf(mkCase(base), i), i);
    const withMetal = normal.candidates.filter((x) => x.safety.some((f) => /Rasaushadhi/.test(f.title)));
    const preg = mkCase({ ...base, patient: { pregnancyStatus: "pregnant", gestationalWeeks: 12 } });
    const r = runAyurveda(preg, stateOf(preg, i), i);
    for (const m of withMetal) expect(r.candidates.find((x) => x.entityId === m.entityId)).toBeUndefined();
  });
});

describe("repertory and homeopathy engine", () => {
  it("navigates chapters and sub-rubrics", () => {
    const ch = childrenOf(null);
    expect(ch.map((c) => c.path)).toContain("Head");
    expect(childrenOf("Head").length).toBeGreaterThan(10);
  });
  it("searches all rubric paths by tokens", () => {
    const r = searchRubrics("head pain sun");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => /head/i.test(x.path) && /sun/i.test(x.path))).toBe(true);
  });
  it("repertorizes by coverage then weighted grade, and reports unknown rubric ids", () => {
    const [a, b] = searchRubrics("head pain pulsating").concat(searchRubrics("stomach nausea"));
    const rp = repertorize([{ rubricId: a.id, weight: 2 }, { rubricId: b.id }, { rubricId: "pub_999999999" }]);
    expect(rp.unknownRubricIds).toEqual(["pub_999999999"]);
    for (let k = 1; k < rp.rows.length; k++) {
      const [p, q] = [rp.rows[k - 1], rp.rows[k]];
      expect(p.covered > q.covered || (p.covered === q.covered && p.weightedScore >= q.weightedScore)).toBe(true);
    }
    expect(rp.method).toMatch(/not a probability/);
  });
  it("suggests modality rubrics from structured details", () => {
    const paths = suggestRubrics(stateOf(migraine, i), i).map((s) => s.path);
    expect(paths).toEqual(expect.arrayContaining(["Head, pain, sides, right", "Head, pain, pressure, amel."]));
  });
  it("labels auto-suggested rubrics and never frames results as probabilities", () => {
    const r = runHomeopathy(migraine, stateOf(migraine, i), i);
    expect(r.rubricsUsed!.every((u) => u.origin === "auto-suggested")).toBe(true);
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates[0].metric.label).toBe("Repertory match");
    expect(r.candidates[0].evidence.map((e) => e.category)).toEqual(expect.arrayContaining(["repertory-reference", "insufficient-evidence"]));
    expect(Object.keys(r.candidates[0].metric)).not.toContain("probability");
    expect(r.methodology).toMatch(/not a probability/);
  });
  it("uses clinician-selected rubrics when provided", () => {
    const rub = searchRubrics("throat pain swallowing")[0];
    const c = mkCase({ homeopathy: { rubrics: [{ rubricId: rub.id, path: rub.path, weight: 2 }] } });
    const r = runHomeopathy(c, stateOf(c, i), i);
    expect(r.rubricsUsed).toEqual([expect.objectContaining({ rubricId: rub.id, origin: "clinician-selected", weight: 2 })]);
  });
});

describe("follow-up questions", () => {
  it("puts safety questions first and asks for unrecorded onset of headache", () => {
    const c = mkCase({ complaint: { symptoms: [{ conceptId: "sym_headache", triggers: [], aggravating: [], relieving: [] }] }, vitals: {} });
    const st = stateOf(c, i);
    const q = followUpQuestions(c, st, i, evaluateRedFlags(c, st, i), matchContexts(c, st, i));
    expect(q[0].priority).toBe("high");
    expect(q.some((x) => x.id === "fq:headache-onset")).toBe(true);
    expect(q.some((x) => x.id === "fq:vitals")).toBe(true);
    expect(q.length).toBeLessThanOrEqual(14);
  });
});
