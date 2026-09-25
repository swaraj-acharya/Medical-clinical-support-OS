/**
 * Server log helper. Logs event names and opaque identifiers only — never clinical content. Anything passed in `meta`
 * goes through redact(), which drops known PHI-bearing keys and truncates free text.
 */
const PHI_KEYS = /^(patientRef|freeText|caseNotes|assessmentNote|prakritiNote|name|substance|reaction|allergies|medications|history|complaint|symptoms|input|inputs|text|notes?|reason|alternative|clinicianRef|vitals|labs|patient|ayurveda|homeopathy|token|password|secret|cookie|authorization)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 64 ? `[string:${value.length}]` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = PHI_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  return "[unsupported]";
}

export function logEvent(event: string, meta: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...(redact(meta) as object) }));
}
