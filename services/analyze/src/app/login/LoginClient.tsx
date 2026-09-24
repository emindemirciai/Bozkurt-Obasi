"use client";

import { useState } from "react";
import { Activity, LogIn, ShieldCheck } from "lucide-react";

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
    unavailable: "Yetkilendirme sunucusuna ulaşılamadı.",
  },
  en: {
    description: (name: string) => "Private traffic and usage dashboard for " + name,
    notice: "Only authorized platform administrators may sign in.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    pending: "Checking...",
    invalid: "Sign-in failed. Check your email and password.",
    unavailable: "Could not reach the authorization server.",
  },
};

export default function LoginClient({ title, name }: LoginClientProps) {
  const [language, setLanguage] = useState<Language>("tr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
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
    <main className="grid min-h-screen place-items-center bg-[#090a0e] px-5 py-10 text-white">
      <section className="w-full max-w-[420px] rounded-lg border border-zinc-800 bg-[#111217] p-7 shadow-2xl shadow-black/40">
        <button type="button" onClick={switchLanguage}
          className="mb-5 rounded border border-zinc-600 px-3 py-1 text-sm text-zinc-200 hover:border-blue-400">
          {language === "tr" ? "EN" : "TR"}
        </button>
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <Activity size={23} />
          </span>
          <div>
            <h1 className="text-xl font-bold">{title[language]}</h1>
            <p className="mt-1 text-sm text-zinc-400">{copy.description(name)}</p>
          </div>
        </div>
        <div className="mb-6 flex items-start gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-zinc-300">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} />
          <span>{copy.notice}</span>
        </div>
        <form className="space-y-4" onSubmit={login}>
          <label className="block text-sm font-medium text-zinc-200">
            {copy.email}
            <input type="email" autoComplete="email" required value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-zinc-700 bg-black px-4 text-white outline-none transition focus:border-blue-500" />
          </label>
          <label className="block text-sm font-medium text-zinc-200">
            {copy.password}
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-zinc-700 bg-black px-4 text-white outline-none transition focus:border-blue-500" />
          </label>
          {message && <p role="alert" className="text-sm text-red-400">{message}</p>}
          <button type="submit" disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 font-semibold transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
            <LogIn size={18} /> {pending ? copy.pending : copy.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
