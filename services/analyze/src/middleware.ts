import { NextRequest, NextResponse } from "next/server";
import {
  getAnalyzeSiteConfig,
  getAnalyzeSessionCookieName,
  type AnalyzeSiteConfig,
} from "./lib/siteConfig";

function configurationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Siteni Analiz Et yapılandırması okunamadı.";
  return NextResponse.json({ message }, { status: 500 });
}

function reject(request: NextRequest, site: AnalyzeSiteConfig, status: number, message: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message }, { status });
  }

  const loginUrl = new URL("/login", request.url);
  if (status === 503) loginUrl.searchParams.set("error", "api");
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(getAnalyzeSessionCookieName(site));
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
  if (!token) return reject(request, site, 401, "Yönetici girişi gerekli.");

  try {
    const response = await fetch(`${site.authApiUrl}/api/admin/session`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return reject(request, site, 401, "Yönetici oturumu geçersiz veya süresi dolmuş.");
    }

    return NextResponse.next();
  } catch {
    return reject(request, site, 503, "Yetkilendirme sunucusuna ulaşılamadı.");
  }
}

export const config = {
  matcher: ["/", "/login", "/api/events", "/api/analyze/:path*"],
};
