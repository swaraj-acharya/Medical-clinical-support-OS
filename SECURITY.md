# Security and privacy

## Access control

- `proxy.ts` protects every page and API route. With `CDS_ACCESS_TOKEN` (≥ 12 chars) and `CDS_SESSION_SECRET`
  (≥ 32 chars) set, users sign in with the clinic token and receive an HMAC-SHA-256 signed session cookie
  (`HttpOnly`, `SameSite=Strict`, `Secure` in production, 8-hour expiry). Token comparison is constant-time.
- Login is rate-limited (5 failures → 5-minute lock per client address) and audit-logged.
- **Fail closed:** in production without a token the app returns 503 for every request unless
  `CDS_ALLOW_UNAUTHENTICATED=true` is set explicitly (for a local synthetic-data demo only). Development mode shows a
  persistent warning banner.
- The shared-token model suits a single clinic. For multiple users, replace it with SSO/OIDC; the audit log already
  records a clinician reference per action.

## Request hardening

- Zod validation on every write endpoint (strict enums, ranges, lengths, identifier patterns); 256 KB body limit.
- Same-origin enforcement (`Origin`/`Sec-Fetch-Site`) on state-changing routes, plus `SameSite=Strict` cookies (CSRF).
- Case/analysis IDs must match `case_[a-f0-9]{12}` / `an_[a-f0-9]{12}` before any filesystem access (no traversal).
- Security headers: CSP (`default-src 'self'`, no third-party origins, `frame-ancestors 'none'`), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy: no-referrer`, restrictive `Permissions-Policy`. API responses are `Cache-Control: no-store`.
- Errors return generic messages; internal details are logged without clinical content.

## Privacy

- Pseudonymous patient references only (pattern-validated); the UI warns against names, phone numbers and Aadhaar.
- Cases, analyses and the audit log are local files (mode 0600) under `CDS_DATA_DIR_RUNTIME`. Encrypt the volume,
  restrict OS access, back up and apply a retention policy (DPDP Act 2023).
- Logs record event names and opaque IDs; `redact()` removes clinical and identifying fields.
- No analytics, no external scripts or fonts, no telemetry from the app.
- Research prompts are generated locally and only copied by the clinician; the app never sends them. They exclude the
  patient reference, exclude free text unless the clinician opts in, and scrub identifiers from any included text
  (see RESEARCH_PROMPTS.md).
- Optional AI extraction (`CDS_AI_MODE=extract`) sends text to the AI provider **only** if `CDS_AI_ALLOW_CLINICAL_TEXT=true`;
  identifiers (emails, phone/ID numbers, titled names) are scrubbed first; returned concept IDs are validated against
  the knowledge base. Disable Next.js telemetry in production with `NEXT_TELEMETRY_DISABLED=1`.

## Audit log

Append-only JSON Lines (`audit/audit.jsonl`). Each entry holds sequence, time, event, case/analysis IDs, actor,
knowledge-base version and hash, payload (inputs, normalised symptoms, patient tags, red-flag rule IDs, rubrics,
candidates, exclusions, sources, decisions) and the SHA-256 of the previous entry. `verifyAuditChain()` detects edits,
deletions and reordering; Data health and each case page show the chain status. For stronger guarantees, ship entries
to write-once storage.

## Threat model (summary)

| Threat | Mitigation |
|---|---|
| Unauthorised access | Token + signed session, fail-closed production default |
| CSRF | Same-origin checks, SameSite=Strict |
| Injection / traversal | Zod schemas, strict ID patterns, no shell or SQL in request paths |
| XSS | React escaping, no `dangerouslySetInnerHTML`, CSP |
| Data leakage via logs/AI | Redaction, AI off by default, explicit opt-in for clinical text |
| Tampering with records | Hash-chained audit, atomic writes |
| Unsafe output | Safety engine first, deterministic pipeline, explicit uncertainty and source display |

Report vulnerabilities privately to the maintainers; do not include patient data in reports.
