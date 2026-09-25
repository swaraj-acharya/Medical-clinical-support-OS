/**
 * Minimal access control for a single-clinic deployment: a shared access token (CDS_ACCESS_TOKEN) exchanged for a signed,
 * expiring session cookie (HMAC-SHA-256 with CDS_SESSION_SECRET). Uses Web Crypto so it runs in the proxy and in routes.
 * For multi-user deployments replace with SSO/OIDC (see SECURITY.md) — the audit log already records a clinicianRef.
 */
export const SESSION_COOKIE = "cds_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type AuthMode = "enabled" | "disabled-dev" | "misconfigured";

export function authMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const token = env.CDS_ACCESS_TOKEN ?? "";
  if (!token) {
    if (env.NODE_ENV === "production" && env.CDS_ALLOW_UNAUTHENTICATED !== "true") return "misconfigured";
    return "disabled-dev";
  }
  if ((env.CDS_SESSION_SECRET ?? "").length < 32 || token.length < 12) return "misconfigured";
  return "enabled";
}

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const A = enc.encode(a);
  const B = enc.encode(b);
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i++) diff |= (A[i] ?? 0) ^ (B[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(secret: string, nowMs = Date.now(), ttl = SESSION_TTL_SECONDS): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + ttl;
  const payload = `v1.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const m = /^v1\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return false;
  if (Number(m[1]) * 1000 < nowMs) return false;
  return safeEqual(m[2], await hmac(secret, `v1.${m[1]}`));
}
