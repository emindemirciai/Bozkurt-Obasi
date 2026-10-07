"use client";

import { useEffect, useState } from "react";
import { Activity, LogIn, Moon, ShieldCheck, Sun } from "lucide-react";
import { useAnalyzeTheme } from "../../lib/useAnalyzeTheme";

type Language = "tr" | "en";
type LoginClientProps = {
  title: { tr: string; en: string };
  name: string;
};

const messages = {
  tr: {
    description: (name: string) => name + " için özel trafik ve kullanım paneli",
    notice: "Yalnızca yetkili platform yöneticisi hesabıyla giriş yapılabilir.",
    email: "E-posta",
    password: "Şifre",
    submit: "Giriş yap",
    pending: "Kontrol ediliyor...",
    invalid: "Giriş yapılamadı. E-posta ve şifreyi kontrol edin.",
    unavailable: "Yetkilendirme API’sine ulaşılamadı veya yanıtı geçersiz. API bağlantısını kontrol edip yeniden deneyin.",
    adminUnavailable: "Yönetici hesabı API’de hazır değil. Dokploy API servisinde ADMIN_EMAIL ve en az 12 karakterlik ADMIN_PASSWORD tanımlayıp yeniden dağıtın.",
    throttled: "Çok sayıda hatalı deneme yapıldı. 10 dakika sonra tekrar deneyin.",
    denied: "Bu panel yalnızca yetkili platform yöneticilerine açıktır.",
    switchLight: "Açık temaya geç",
    switchDark: "Koyu temaya geç",
    light: "Açık",
    dark: "Koyu",
  },
  en: {
    description: (name: string) => "Private traffic and usage dashboard for " + name,
    notice: "Only authorized platform administrators may sign in.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    pending: "Checking...",
    invalid: "Sign-in failed. Check your email and password.",
    unavailable: "The authentication API could not be reached or returned an invalid response. Check the API connection and try again.",
    adminUnavailable: "The administrator account is not ready in the API. Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in the Dokploy API service, then redeploy.",
    throttled: "Too many failed attempts. Try again in 10 minutes.",
    denied: "Only authorized platform administrators may access this dashboard.",
    switchLight: "Switch to light theme",
    switchDark: "Switch to dark theme",
    light: "Light",
    dark: "Dark",
  },
};

type LoginMessage = "invalid" | "unavailable" | "adminUnavailable" | "throttled" | "denied" | "";

function failureMessage(status: number, error: unknown): LoginMessage {
  if (error === "admin_unavailable") return "adminUnavailable";
  if (error === "auth_api_unavailable" || status >= 500) return "unavailable";
  if (error === "login_rate_limited" || status === 429) return "throttled";
  if (status === 403) return "denied";
  return "invalid";
}

export default function LoginClient({ title, name }: LoginClientProps) {
  const [language, setLanguage] = useState<Language>("tr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<LoginMessage>("");
  const [pending, setPending] = useState(false);
  const { theme, chooseTheme } = useAnalyzeTheme();
  const isDark = theme === "dark";
  const copy = messages[language];

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "api") setMessage("unavailable");
    else if (error === "admin_unavailable") setMessage("adminUnavailable");
    else if (error === "throttled") setMessage("throttled");
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    const controller = new AbortController();
    // The server performs two separately bounded eight-second API requests.
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(failureMessage(response.status, data.error));
        return;
      }
      if (data.ok !== true) {
        setMessage("unavailable");
        return;
      }
      window.location.href = "/";
    } catch {
      setMessage("unavailable");
    } finally {
      clearTimeout(timeout);
      setPending(false);
    }
  }

  function switchLanguage() {
    const next = language === "tr" ? "en" : "tr";
    setLanguage(next);
    document.documentElement.lang = next;
  }

  return (
    <main className="analyze-login grid min-h-screen place-items-center px-5 py-10">
      <section className="analyze-login-card w-full max-w-[420px] rounded-lg border p-7 shadow-xl">
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={switchLanguage}
            className="analyze-login-control rounded border px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2"
            aria-label={language === "tr" ? "Switch to English" : "Türkçeye geç"}
          >
            {language === "tr" ? "EN" : "TR"}
          </button>
          <button
            type="button"
            onClick={() => chooseTheme(isDark ? "light" : "dark")}
            className="analyze-login-control flex items-center gap-2 rounded border px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2"
            aria-label={isDark ? copy.switchLight : copy.switchDark}
            title={isDark ? copy.switchLight : copy.switchDark}
          >
            {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            {isDark ? copy.light : copy.dark}
          </button>
        </div>
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border analyze-login-brand">
            <Activity size={23} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold">{title[language]}</h1>
            <p className="analyze-login-muted mt-1 text-sm">{copy.description(name)}</p>
          </div>
        </div>
        <div className="analyze-login-notice mb-6 flex items-start gap-3 rounded-md border p-3 text-sm">
          <ShieldCheck className="mt-0.5 shrink-0 analyze-login-shield" size={18} aria-hidden="true" />
          <span>{copy.notice}</span>
        </div>
        <form className="space-y-4" onSubmit={login}>
          <label className="block text-sm font-medium">
            {copy.email}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="analyze-login-input mt-2 h-12 w-full rounded-md border px-4 transition"
            />
          </label>
          <label className="block text-sm font-medium">
            {copy.password}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="analyze-login-input mt-2 h-12 w-full rounded-md border px-4 transition"
            />
          </label>
          {message && <p role="alert" className="analyze-login-error text-sm">{copy[message]}</p>}
          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md analyze-login-submit font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            <LogIn size={18} aria-hidden="true" /> {pending ? copy.pending : copy.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
