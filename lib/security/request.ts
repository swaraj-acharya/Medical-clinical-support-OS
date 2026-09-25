import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ConflictError, NotFoundError } from "../storage/cases";
import { logEvent } from "./log";

const MAX_BODY = 256 * 1024;

/** CSRF defence for state-changing requests: same-origin only (in addition to SameSite=Strict cookies). */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
  }
  return null;
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return { error: NextResponse.json({ error: "Request too large" }, { status: 413 }) };
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return { error: NextResponse.json({ error: "Request too large" }, { status: 413 }) };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { error: NextResponse.json({ error: "Validation failed", issues: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 }) };
  return { data: r.data };
}

export function handleError(e: unknown, route: string): NextResponse {
  if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
  if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
  if (e instanceof ZodError) return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  logEvent("api.error", { route, error: e instanceof Error ? e.name : "unknown" });
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

/** Clinician reference for audit entries (pseudonymous; supplied by the client, validated by schema). */
export const actorFrom = (req: Request) => {
  const h = req.headers.get("x-clinician-ref") ?? "";
  return /^[A-Za-z0-9 ._-]{1,60}$/.test(h) ? h : "unspecified";
};
