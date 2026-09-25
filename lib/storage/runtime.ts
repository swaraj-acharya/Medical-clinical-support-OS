import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Directory for cases, analyses and the audit log (never inside the knowledge directory). */
export function runtimeDir(): string {
  const d = process.env.CDS_DATA_DIR_RUNTIME ? path.resolve(process.env.CDS_DATA_DIR_RUNTIME) : path.join(process.cwd(), "data", "runtime");
  mkdirSync(d, { recursive: true });
  return d;
}

export function sub(dir: string): string {
  const p = path.join(runtimeDir(), dir);
  mkdirSync(p, { recursive: true });
  return p;
}

/** Atomic JSON write (temp file + rename) so a crash never leaves a half-written record. */
export function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 1), { mode: 0o600 });
  renameSync(tmp, file);
}

/** Serialises async writers within this process (file-based store; see ARCHITECTURE.md for the PostgreSQL path). */
let chain: Promise<unknown> = Promise.resolve();
export function serialized<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

export const CASE_ID_RE = /^case_[a-f0-9]{12}$/;
export const ANALYSIS_ID_RE = /^an_[a-f0-9]{12}$/;
export const newId = (prefix: "case" | "an" | "dec") => `${prefix}_${randomBytes(6).toString("hex")}`;
