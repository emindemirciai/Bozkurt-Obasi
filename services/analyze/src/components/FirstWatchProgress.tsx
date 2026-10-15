"use client";

import { useMemo, useState } from "react";
import { buildProgressionFunnel } from "../lib/progression.mjs";

const copy = {
  tr: {
    title: "İlk Nöbet · Görev ilerlemesi", fresh: "Yeni obalar", returning: "Mevcut obalar",
    sample: "Gözlenen bölüm", finished: "Bölümü bitiren", task: "Görev", done: "Hedef tamamlandı", claimed: "Ödül alındı", current: "Sıradaki ödül",
    note: "Örneklem, seçilen tarih aralığında ilk kez ölçülen tarayıcı/bölüm kayıtlarıdır; kesin oyuncu sayısı değildir. Aynı kişi farklı cihazlarda tekrar sayılabilir. Mevcut obaların önceki başarıları ayrı gösterilir.",
    waiting: "Sıradaki ödül, son alınan kayıttaki ilerleme konumudur; oyunu terk etme anlamına gelmez. DNT/GPC tercihleri ve ölçüm engelleyicileri nedeniyle tüm oyuncuları kapsamaz.",
    empty: "Bu grupta henüz ölçülen bölüm yok.",
    milestones: ["İlk inşaat", "İlk savaş", "İlk zafer", "İlk keşif"],
    steps: ["Yol azığı", "İlk yapı", "Muhafız eğitimi", "Çakal pususu", "Yeniden toparlan", "İlk keşif", "İlk ekipman", "Sürünün yolculuğu"],
  },
  en: {
    title: "First Watch · Quest progress", fresh: "New settlements", returning: "Existing settlements",
    sample: "Observed chapters", finished: "Chapter finished", task: "Quest", done: "Objective complete", claimed: "Reward claimed", current: "Next reward",
    note: "The sample contains browser/chapter records first observed within the selected date range, not exact player counts. One person may count again on another device. Existing settlements and their past achievements are shown separately.",
    waiting: "Next reward is the position in the latest received snapshot, not evidence of abandonment. DNT/GPC preferences and tracking blockers mean this does not cover every player.",
    empty: "No observed chapters in this cohort yet.",
    milestones: ["First building", "First battle", "First victory", "First expedition"],
    steps: ["Road provisions", "First building", "Guardian training", "Jackal ambush", "Recover together", "First expedition", "First equipment", "The herd's journey"],
  },
};

export default function FirstWatchProgress({ events, sites, start, end, language, theme }: {
  events: Record<string, unknown>[]; sites: string[]; start: number; end: number;
  language: "tr" | "en"; theme: "dark" | "light";
}) {
  const [cohort, setCohort] = useState("new");
  const t = copy[language];
  const data = useMemo(() => buildProgressionFunnel(events, { sites, start, end, cohort }), [events, sites, start, end, cohort]);
  const dark = theme === "dark";
  const panel = dark ? "analyze-dark-panel" : "border-slate-200 bg-white text-slate-950";
  const muted = dark ? "analyze-dark-muted" : "text-slate-500";
  return <section className={"mt-6 rounded-2xl border p-5 shadow-sm " + panel} aria-label={t.title}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-lg font-bold">{t.title}</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label={language === "tr" ? "Oba grubu" : "Settlement cohort"}>
        {[["new", t.fresh], ["returning", t.returning]].map(([value, label]) => <button key={value} type="button" aria-pressed={cohort === value}
          onClick={() => setCohort(value)} className={"rounded-lg border px-3 py-2 text-sm font-bold " + (cohort === value ? dark ? "analyze-dark-selected" : "bg-slate-200" : dark ? "analyze-dark-control" : "bg-white")}>
          {label}</button>)}
      </div>
    </div>
    <p className={"mt-3 text-sm " + muted}>{t.note}</p>
    <div className="my-4 flex flex-wrap gap-x-8 gap-y-2 text-sm"><p>{t.sample}: <strong>{data.started}</strong></p><p>{t.finished}: <strong>{data.finished} / {data.started}</strong></p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[data.firstBuild, data.firstBattle, data.firstVictory, data.firstExpedition].map((count, index) =>
      <div key={t.milestones[index]} className={"rounded-lg p-3 " + (dark ? "analyze-dark-soft" : "bg-slate-50")}>
        <p className={"text-xs " + muted}>{t.milestones[index]}</p><p className="mt-1 text-xl font-bold">{count} <span className="text-xs font-normal">({data.started ? Math.round(count / data.started * 100) : 0}%)</span></p>
      </div>)}</div>
    {!data.started ? <p className={"py-8 text-center " + muted}>{t.empty}</p> : <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[580px] text-left text-sm"><thead><tr className="border-b border-current/10">
        {[t.task, t.done, t.claimed, t.current].map((label) => <th key={label} scope="col" className="px-2 py-3">{label}</th>)}</tr></thead>
        <tbody>{data.steps.map((step, index) => <tr key={step.id} className="border-b border-current/10">
          <th scope="row" className="px-2 py-3 font-medium">{index + 1}. {t.steps[index]}</th>
          <td className="px-2 py-3">{step.completed} ({step.percent}%)<div className="mt-1 h-1.5 w-24 overflow-hidden rounded bg-current/10"><div className="h-full bg-emerald-600" style={{ width: step.percent + "%" }} /></div></td>
          <td className="px-2 py-3">{step.claimed}</td><td className="px-2 py-3">{step.current}</td></tr>)}</tbody>
      </table></div>}
    <p className={"mt-4 text-xs " + muted}>{t.waiting}</p>
  </section>;
}
