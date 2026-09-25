import { describe, expect, it } from "vitest";
import { authMode, createSessionToken, safeEqual, verifySessionToken } from "../../lib/auth/session";
import { scrubIdentifiers } from "../../lib/ai/extract";
import { redact } from "../../lib/security/log";
import { assertSameOrigin, parseJson } from "../../lib/security/request";
import { getAnalysis, getCase, NotFoundError } from "../../lib/storage/cases";
import { caseInputSchema, decisionSchema } from "../../lib/validation/case-schema";
import { DEMO_CASES } from "../../lib/demo/cases";

const SECRET = "x".repeat(40);

describe("input validation", () => {
  const good = DEMO_CASES[0].input;
  it("accepts a valid case and rejects identifiers in the patient reference", () => {
    expect(caseInputSchema.safeParse(good).success).toBe(true);
    expect(caseInputSchema.safeParse({ ...good, patient: { ...good.patient, patientRef: "Ramesh Kumar 9876543210" } }).success).toBe(false);
  });
  it("rejects out-of-range values, unknown enums and oversize arrays", () => {
    expect(caseInputSchema.safeParse({ ...good, patient: { ...good.patient, ageYears: 400 } }).success).toBe(false);
    expect(caseInputSchema.safeParse({ ...good, systems: ["astrology"] }).success).toBe(false);
    expect(caseInputSchema.safeParse({ ...good, medications: Array.from({ length: 41 }, () => ({ name: "x" })) }).success).toBe(false);
    expect(caseInputSchema.safeParse({ ...good, complaint: { ...good.complaint, chiefComplaintId: "<script>" } }).success).toBe(false);
  });
  it("requires a reason for rejections", () => {
    expect(decisionSchema.safeParse({ candidateId: "allo:drug_x", system: "allopathy", action: "rejected", clinicianRef: "Dr-A" }).success).toBe(false);
    expect(decisionSchema.safeParse({ candidateId: "allo:drug_x", system: "allopathy", action: "rejected", reason: "Patient preference", clinicianRef: "Dr-A" }).success).toBe(true);
  });
  it("parseJson returns 422 with issues and 413 for oversize bodies", async () => {
    const bad = await parseJson(new Request("http://x/api", { method: "POST", body: JSON.stringify({ patient: {} }) }), caseInputSchema);
    expect("error" in bad && bad.error.status).toBe(422);
    const big = await parseJson(new Request("http://x/api", { method: "POST", body: "x".repeat(300_000) }), caseInputSchema);
    expect("error" in big && big.error.status).toBe(413);
    const notJson = await parseJson(new Request("http://x/api", { method: "POST", body: "{nope" }), caseInputSchema);
    expect("error" in notJson && notJson.error.status).toBe(400);
  });
});

describe("storage identifiers", () => {
  it("rejects path traversal and malformed ids before touching the filesystem", () => {
    for (const id of ["../../etc/passwd", "case_../../x", "case_ZZZZZZZZZZZZ", "", "case_0123456789ab/../x"]) expect(() => getCase(id)).toThrow(NotFoundError);
    expect(() => getAnalysis("../secrets")).toThrow(NotFoundError);
  });
});

describe("session tokens and auth mode", () => {
  it("signs, verifies and expires tokens", async () => {
    const now = Date.now();
    const t = await createSessionToken(SECRET, now);
    expect(await verifySessionToken(t, SECRET, now)).toBe(true);
    expect(await verifySessionToken(t, "y".repeat(40), now)).toBe(false);
    expect(await verifySessionToken(t, SECRET, now + 9 * 3600_000)).toBe(false);
    expect(await verifySessionToken(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")), SECRET, now)).toBe(false);
    const [v, exp, sig] = t.split(".");
    expect(await verifySessionToken(`${v}.${Number(exp) + 99999}.${sig}`, SECRET, now)).toBe(false);
    expect(await verifySessionToken(undefined, SECRET, now)).toBe(false);
  });
  it("fails closed in production without a token", () => {
    expect(authMode({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("misconfigured");
    expect(authMode({ NODE_ENV: "production", CDS_ALLOW_UNAUTHENTICATED: "true" } as NodeJS.ProcessEnv)).toBe("disabled-dev");
    expect(authMode({ NODE_ENV: "production", CDS_ACCESS_TOKEN: "long-enough-token", CDS_SESSION_SECRET: "short" } as NodeJS.ProcessEnv)).toBe("misconfigured");
    expect(authMode({ NODE_ENV: "production", CDS_ACCESS_TOKEN: "long-enough-token", CDS_SESSION_SECRET: SECRET } as NodeJS.ProcessEnv)).toBe("enabled");
  });
  it("compares secrets in constant time semantics", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("CSRF, logging and privacy", () => {
  it("rejects cross-site state-changing requests", () => {
    const req = (h: Record<string, string>) => new Request("http://localhost:3000/api/cases", { method: "POST", headers: h });
    expect(assertSameOrigin(req({ host: "localhost:3000", origin: "http://evil.example" }))?.status).toBe(403);
    expect(assertSameOrigin(req({ "sec-fetch-site": "cross-site" }))?.status).toBe(403);
    expect(assertSameOrigin(req({ host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))).toBeNull();
  });
  it("redacts clinical content from log metadata", () => {
    const out = redact({ caseId: "case_1", patientRef: "OPD-1", input: { complaint: "headache" }, freeText: "long", nested: { reason: "x", status: "ok" } }) as Record<string, any>;
    expect(out.caseId).toBe("case_1");
    expect(out.patientRef).toBe("[redacted]");
    expect(out.input).toBe("[redacted]");
    expect(out.nested.reason).toBe("[redacted]");
    expect(out.nested.status).toBe("ok");
  });
  it("scrubs direct identifiers before any external AI call", () => {
    const s = scrubIdentifiers("Mr Ramesh Kumar, phone +91 98765 43210, email r.k@example.com, Aadhaar 1234 5678 9012 has headache");
    expect(s).not.toMatch(/Ramesh|98765|example\.com|1234 5678/);
    expect(s).toMatch(/headache/);
  });
});
