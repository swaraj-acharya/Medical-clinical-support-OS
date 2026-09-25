/**
 * Append-only, hash-chained audit log (JSON Lines). Each entry stores the SHA-256 of the previous entry, so any edit or
 * deletion inside the file is detectable with verifyAuditChain(). The log is local; nothing is sent externally.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { serialized, sub } from "./runtime";

export type AuditEvent =
  | "case.created" | "analysis.run" | "redflag.acknowledged" | "decision.recorded"
  | "auth.login" | "auth.failed" | "demo.seeded" | "extract.run" | "knowledge.reloaded";

export interface AuditEntry {
  seq: number;
  at: string;
  event: AuditEvent;
  caseId?: string;
  analysisId?: string;
  actor?: string;
  kbVersion?: string;
  kbContentHash?: string;
  payload: unknown;
  prevHash: string;
  hash: string;
}

const GENESIS = "0".repeat(64);
const file = () => path.join(sub("audit"), "audit.jsonl");
const hashOf = (e: Omit<AuditEntry, "hash">) => createHash("sha256").update(JSON.stringify(e)).digest("hex");

export function readAudit(filter?: { caseId?: string }): AuditEntry[] {
  const f = file();
  if (!existsSync(f)) return [];
  const rows = readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEntry);
  return filter?.caseId ? rows.filter((r) => r.caseId === filter.caseId) : rows;
}

export function appendAudit(e: Omit<AuditEntry, "seq" | "at" | "prevHash" | "hash"> & { at?: string }): Promise<AuditEntry> {
  return serialized(() => {
    const all = readAudit();
    const last = all.at(-1);
    const base: Omit<AuditEntry, "hash"> = { seq: (last?.seq ?? 0) + 1, at: e.at ?? new Date().toISOString(), event: e.event, caseId: e.caseId, analysisId: e.analysisId, actor: e.actor, kbVersion: e.kbVersion, kbContentHash: e.kbContentHash, payload: e.payload, prevHash: last?.hash ?? GENESIS };
    const entry: AuditEntry = { ...base, hash: hashOf(base) };
    appendFileSync(file(), JSON.stringify(entry) + "\n", { mode: 0o600 });
    return entry;
  });
}

export function verifyAuditChain(entries = readAudit()): { ok: boolean; count: number; brokenAt?: number; reason?: string } {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const { hash, ...rest } = entries[i];
    if (rest.prevHash !== prev) return { ok: false, count: entries.length, brokenAt: rest.seq, reason: "prevHash does not match previous entry" };
    if (hashOf(rest) !== hash) return { ok: false, count: entries.length, brokenAt: rest.seq, reason: "entry content altered" };
    if (i > 0 && rest.seq !== entries[i - 1].seq + 1) return { ok: false, count: entries.length, brokenAt: rest.seq, reason: "sequence gap" };
    prev = hash;
  }
  return { ok: true, count: entries.length };
}
