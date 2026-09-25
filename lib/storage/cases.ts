import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AnalysisResult } from "../../types/recommendation";
import type { Acknowledgement } from "../engines/analyze";
import type { CaseInput, DecisionInput } from "../validation/case-schema";
import { ANALYSIS_ID_RE, CASE_ID_RE, newId, serialized, sub, writeJsonAtomic } from "./runtime";

export interface DecisionRecord extends DecisionInput {
  id: string;
  at: string;
  analysisId: string;
  candidateName: string;
  kbVersion: string;
}

export interface CaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  demoKey?: string;
  input: CaseInput;
  analyses: { analysisId: string; createdAt: string; kbVersion: string; redFlagStatus: string; withheld: boolean; candidateCounts: Record<string, number> }[];
  acknowledgements: Acknowledgement[];
  decisions: DecisionRecord[];
}

export class NotFoundError extends Error {}
/** A request that is well-formed but conflicts with clinical-safety or workflow rules (HTTP 409). */
export class ConflictError extends Error {}

const caseFile = (id: string) => {
  if (!CASE_ID_RE.test(id)) throw new NotFoundError("Invalid case id");
  return path.join(sub("cases"), `${id}.json`);
};
const analysisFile = (id: string) => {
  if (!ANALYSIS_ID_RE.test(id)) throw new NotFoundError("Invalid analysis id");
  return path.join(sub("analyses"), `${id}.json`);
};

export function getCase(id: string): CaseRecord {
  const f = caseFile(id);
  if (!existsSync(f)) throw new NotFoundError("Case not found");
  return JSON.parse(readFileSync(f, "utf8")) as CaseRecord;
}

export function listCases(): CaseRecord[] {
  const dir = sub("cases");
  return readdirSync(dir)
    .filter((f) => /^case_[a-f0-9]{12}\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as CaseRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createCase(input: CaseInput, demoKey?: string): Promise<CaseRecord> {
  return serialized(() => {
    const now = new Date().toISOString();
    const rec: CaseRecord = { id: newId("case"), createdAt: now, updatedAt: now, demoKey, input, analyses: [], acknowledgements: [], decisions: [] };
    writeJsonAtomic(caseFile(rec.id), rec);
    return rec;
  });
}

export function updateCase(id: string, fn: (c: CaseRecord) => void): Promise<CaseRecord> {
  return serialized(() => {
    const c = getCase(id);
    fn(c);
    c.updatedAt = new Date().toISOString();
    writeJsonAtomic(caseFile(id), c);
    return c;
  });
}

export function saveAnalysis(a: AnalysisResult) {
  writeJsonAtomic(analysisFile(a.analysisId), a);
}

export function getAnalysis(id: string): AnalysisResult {
  const f = analysisFile(id);
  if (!existsSync(f)) throw new NotFoundError("Analysis not found");
  return JSON.parse(readFileSync(f, "utf8")) as AnalysisResult;
}
