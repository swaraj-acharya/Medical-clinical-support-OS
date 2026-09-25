import { NextResponse } from "next/server";
import { z } from "zod";
import { authMode, createSessionToken, safeEqual, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { assertSameOrigin, parseJson } from "@/lib/security/request";
import { appendAudit } from "@/lib/storage/audit";

export const dynamic = "force-dynamic";
const body = z.object({ token: z.string().min(1).max(200) });
const failures = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  if (authMode() !== "enabled") return NextResponse.json({ error: "Access control is not enabled" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const f = failures.get(ip);
  if (f && f.until > Date.now()) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const p = await parseJson(req, body);
  if ("error" in p) return p.error;
  if (!safeEqual(p.data.token, process.env.CDS_ACCESS_TOKEN ?? "")) {
    const n = (f?.n ?? 0) + 1;
    failures.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 });
    await appendAudit({ event: "auth.failed", payload: { attempts: n } });
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }
  failures.delete(ip);
  await appendAudit({ event: "auth.login", payload: {} });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(process.env.CDS_SESSION_SECRET!), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
