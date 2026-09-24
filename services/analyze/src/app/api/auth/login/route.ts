import { NextResponse } from "next/server";
import {
  getAnalyzeSiteConfig,
  getAnalyzeSessionCookieName,
} from "../../../../lib/siteConfig";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const site = getAnalyzeSiteConfig();

  if (site.authMode !== "platform-admin") {
    return NextResponse.json(
      { message: "Bu site yönetici girişi kullanmıyor." },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ message: "E-posta ve şifre zorunludur." }, { status: 400 });
    }

    const loginResponse = await fetch(`${site.authApiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const loginData = await loginResponse.json().catch(() => ({}));

    if (!loginResponse.ok || typeof loginData.token !== "string") {
      return NextResponse.json(
        {
          message: typeof loginData.message === "string"
            ? loginData.message
            : "Giriş yapılamadı.",
        },
        { status: loginResponse.status || 401 },
      );
    }

    const adminResponse = await fetch(`${site.authApiUrl}/api/admin/session`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
      cache: "no-store",
    });

    if (!adminResponse.ok) {
      return NextResponse.json(
        { message: "Bu panel yalnızca yetkili platform yöneticilerine açıktır." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: getAnalyzeSessionCookieName(site),
      value: loginData.token,
      httpOnly: true,
      secure: request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json(
      { message: "Yetkilendirme sunucusuna ulaşılamadı." },
      { status: 503 },
    );
  }
}
