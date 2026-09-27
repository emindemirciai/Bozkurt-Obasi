"use client";

import { useState } from "react";
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
    unavailable: "Yönetici girişi şu anda kullanılamıyor. API bağlantısını ve yönetici ayarlarını kontrol edin.",
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
    unavailable: "Administrator sign-in is currently unavailable. Check the API connection and administrator settings.",
    switchLight: "Switch to light theme",
    switchDark: "Switch to dark theme",
    light: "Light",
    dark: "Dark",
  },
};

export default function LoginClient({ title, name }: LoginClientProps) {
  const [language, setLanguage] = useState<Language>("tr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const { theme, chooseTheme } = useAnalyzeTheme();
  const isDark = theme === "dark";
  const copy = messages[language];

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setMessage(response.status === 503 ? copy.unavailable : copy.invalid);
        return;
      }
      window.location.href = "/";
    } catch {
      setMessage(copy.unavailable);
    } finally {
      setPending(false);
    }
  }

  function switchLanguage() {
    const next = language === "tr" ? "en" : "tr";
    setLanguage(next);
    setMessage("");
    document.documentElement.lang = next;
  }

  return (
    <main className="analyze-login grid min-h-screen place-items-center px-5 py-10">
      <section className="analyze-login-card w-full max-w-[420px] rounded-lg border p-7 shadow-xl">
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={switchLanguage}
            className="analyze-login-control rounded border px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            aria-label={language === "tr" ? "Switch to English" : "Türkçeye geç"}
          >
            {language === "tr" ? "EN" : "TR"}
          </button>
          <button
            type="button"
            onClick={() => chooseTheme(isDark ? "light" : "dark")}
            className="analyze-login-control flex items-center gap-2 rounded border px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            aria-label={isDark ? copy.switchLight : copy.switchDark}
            title={isDark ? copy.switchLight : copy.switchDark}
          >
            {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            {isDark ? copy.light : copy.dark}
          </button>
        </div>
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-500">
            <Activity size={23} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold">{title[language]}</h1>
            <p className="analyze-login-muted mt-1 text-sm">{copy.description(name)}</p>
          </div>
        </div>
        <div className="analyze-login-notice mb-6 flex items-start gap-3 rounded-md border p-3 text-sm">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-500" size={18} aria-hidden="true" />
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
          {message && <p role="alert" className="analyze-login-error text-sm">{message}</p>}
          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            <LogIn size={18} aria-hidden="true" /> {pending ? copy.pending : copy.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
