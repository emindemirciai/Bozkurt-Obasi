import { NextResponse } from "next/server";
import {
  getAnalyzeSiteConfig,
  getAnalyzeSessionCookieName,
} from "../../../../lib/siteConfig";
import { signInPlatformAdmin } from "../../../../lib/platformAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const site = getAnalyzeSiteConfig();

  if (site.authMode !== "platform-admin") {
    return NextResponse.json(
      { message: "Bu site yönetici girişi kullanmıyor." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const credentials = body as Record<string, unknown>;
  const email = typeof credentials.email === "string" ? credentials.email.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!email || !password || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await signInPlatformAdmin(site.authApiUrl, email, password);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getAnalyzeSessionCookieName(site),
    value: result.token,
    httpOnly: true,
    secure: request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
      || new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: Math.min(60 * 60 * 24 * 7, Math.floor((result.session.expiresAt - Date.now()) / 1000)),
  });
  return response;
}
