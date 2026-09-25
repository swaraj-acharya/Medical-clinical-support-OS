import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const ROOT = path.resolve(__dirname, "..", "..");
export const DATA = path.join(ROOT, "data");
export const today = () => new Date().toISOString().slice(0, 10);

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export function writeJson(file: string, data: unknown, pretty = true) {
  ensureDir(path.dirname(file));
  writeFileSync(file, JSON.stringify(data, null, pretty ? 2 : 0) + "\n");
}

export function writeGzJson(file: string, data: unknown): { bytes: number; sha256: string } {
  ensureDir(path.dirname(file));
  const buf = gzipSync(Buffer.from(JSON.stringify(data)), { level: 9 });
  writeFileSync(file, buf);
  return { bytes: buf.length, sha256: sha256(buf) };
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Download a file only from an allow-listed origin; importers never fetch arbitrary URLs. */
const ALLOWED_ORIGINS = [
  "https://raw.githubusercontent.com",
  "https://api.fda.gov",
  "https://rxnav.nlm.nih.gov",
];

export async function download(url: string, dest: string): Promise<Buffer> {
  if (!ALLOWED_ORIGINS.some((o) => url.startsWith(o + "/"))) throw new Error(`Refusing to download from non-allow-listed origin: ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": "cds-knowledge-importer/1.0" } });
  if (!res.ok) throw new Error(`Download failed ${res.status} ${res.statusText}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  ensureDir(path.dirname(dest));
  writeFileSync(dest, buf);
  return buf;
}

export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);
