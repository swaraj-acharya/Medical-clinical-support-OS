import { NextResponse, type NextRequest } from "next/server";
import { authMode, SESSION_COOKIE, verifySessionToken } from "./lib/auth/session";

/** Access control for every page and API route (Next.js 16 proxy, formerly "middleware"). Fails closed when misconfigured. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const mode = authMode();
  if (mode === "disabled-dev") return NextResponse.next();
  const isApi = pathname.startsWith("/api/");
  if (mode === "misconfigured") {
    const msg = "Access control is not configured. Set CDS_ACCESS_TOKEN (≥12 chars) and CDS_SESSION_SECRET (≥32 chars), or CDS_ALLOW_UNAUTHENTICATED=true for a local synthetic-data demo only.";
    return isApi ? NextResponse.json({ error: msg }, { status: 503 }) : new NextResponse(msg, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (pathname === "/login" || pathname === "/api/auth/login") return NextResponse.next();
  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, process.env.CDS_SESSION_SECRET ?? "");
  if (ok) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"] };
