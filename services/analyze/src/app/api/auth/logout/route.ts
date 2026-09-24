import { NextResponse } from "next/server";
import {
  getAnalyzeSiteConfig,
  getAnalyzeSessionCookieName,
} from "../../../../lib/siteConfig";

export async function POST() {
  const site = getAnalyzeSiteConfig();
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: getAnalyzeSessionCookieName(site),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
