import { NextRequest, NextResponse } from "next/server";
import {
  getAnalyzeSiteConfig,
  getAnalyzeSessionCookieName,
  type AnalyzeSiteConfig,
} from "./lib/siteConfig";
import { verifyPlatformAdminSession, type PlatformAuthError } from "./lib/platformAuth";

function configurationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Siteni Analiz Et yapılandırması okunamadı.";
  return NextResponse.json({ message }, { status: 500 });
}

function reject(request: NextRequest, site: AnalyzeSiteConfig, status: number, error: PlatformAuthError) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error }, { status });
  }

  const loginUrl = new URL("/login", request.url);
  if (error === "admin_unavailable") loginUrl.searchParams.set("error", "admin_unavailable");
  else if (status === 503) loginUrl.searchParams.set("error", "api");
  else if (status === 429) loginUrl.searchParams.set("error", "throttled");
  const response = NextResponse.redirect(loginUrl);
  if (status === 401 || status === 403) {
    response.cookies.delete(getAnalyzeSessionCookieName(site));
  }
  return response;
}

export async function middleware(request: NextRequest) {
  let site: AnalyzeSiteConfig;

  try {
    site = getAnalyzeSiteConfig();
  } catch (error) {
    return configurationError(error);
  }

  if (request.nextUrl.pathname === "/login") {
    return site.authMode === "platform-admin"
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/", request.url));
  }

  if (site.authMode === "none") {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAnalyzeSessionCookieName(site))?.value;
  if (!token) return reject(request, site, 401, "admin_session_required");

  const result = await verifyPlatformAdminSession(site.authApiUrl, token);
  if (result.ok === false) return reject(request, site, result.status, result.error);
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/api/events", "/api/analyze/:path*"],
};
