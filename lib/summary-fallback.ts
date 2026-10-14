// Built-in summary, used when the AI service is unavailable (no key, no credit,
// rate limit, network). It only restates the numbers computed in code, in fixed
// plain sentences. No interpretation, no advice. It is labelled as written
// automatically wherever it is shown.

import type { AiSummary, SummaryFacts } from "./summary";

type Part = "morning" | "afternoon" | "evening" | "night";

const TEXT = {
  en: {
    part: { morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" } as Record<Part, string>,
    overview: (f: SummaryFacts) => {
      const o = f.overall;
      const parts = [
        `Over ${f.period.days} days (${f.period.start} to ${f.period.end}), ${o.taken} of ${o.doses_due} scheduled doses were recorded as taken${o.adherence_pct === null ? "" : ` (${o.adherence_pct}%)`}.`,
        `${o.missed} doses were not confirmed in time${o.taken_late ? `, and ${o.taken_late} were confirmed more than 30 minutes late` : ""}.`,
        "These figures come from button presses by the patient and caregiver, not from a check of the medicines themselves.",
      ];
      return parts.join(" ");
    },
    medicine: (m: SummaryFacts["medications"][number]) =>
      m.adherence_pct === null
        ? `${m.name} (${m.dose}): no doses due in this period.`
        : `${m.name} (${m.dose}): ${m.adherence_pct}% (${m.taken} of ${m.doses_due} doses taken, ${m.missed} missed).`,
    mostMissed: (part: string, n: number, total: number) => `Most missed doses were in the ${part} (${n} of ${total}).`,
    evening: (e: SummaryFacts["evening_doses_weekday_vs_weekend"]) =>
      `Evening doses: ${e.weekday_missed} of ${e.weekday_doses} missed on weekdays, and ${e.weekend_missed} of ${e.weekend_doses} at weekends.`,
    gap: (g: SummaryFacts["gaps_over_24h_without_any_dose_taken"][number]) =>
      `No dose was recorded as taken between ${g.from} and ${g.to} (about ${g.hours} hours).`,
    double: (d: SummaryFacts["possible_double_doses"][number]) =>
      `${d.medicine} on ${d.date} (${d.scheduled_time}) was confirmed more than once: ${d.confirmations.join(", ")}.`,
    byCaregiver: (n: number, total: number) =>
      `${n} of ${total} taken doses were confirmed by the caregiver rather than the patient.`,
    byVoice: (n: number) => `${n} doses were confirmed by voice.`,
    askRoutine: (part: string) => `Could the patient describe their usual routine in the ${part}?`,
    askDouble: "How does the patient keep track of doses when someone else helps?",
    askGap: (g: SummaryFacts["gaps_over_24h_without_any_dose_taken"][number]) =>
      `What happened between ${g.from} and ${g.to}, when no doses were recorded?`,
    askNotes: "Would the patient like to talk about anything in the caregiver's notes?",
    limits: [
      "Based on logs entered by the patient and caregiver. Not independently checked.",
      "A dose marked as taken means a button was pressed. It does not prove the medicine was swallowed.",
    ],
    simulated: "Some medicines came from a simulated hospital record used for demonstration.",
    automatic: "This summary was written automatically from the numbers, because the AI service was not available.",
  },
  zh: {
    part: { morning: "早上", afternoon: "下午", evening: "晚上", night: "夜間" } as Record<Part, string>,
    overview: (f: SummaryFacts) => {
      const o = f.overall;
      const parts = [
        `在 ${f.period.days} 日內（${f.period.start} 至 ${f.period.end}），${o.doses_due} 次應服劑量中有 ${o.taken} 次記錄為已服用${o.adherence_pct === null ? "" : `（${o.adherence_pct}%）`}。`,
        `有 ${o.missed} 次未有按時確認${o.taken_late ? `，另有 ${o.taken_late} 次遲過 30 分鐘才確認` : ""}。`,
        "以上數字來自病人和照顧者按下的確認，並非實際檢查藥物所得。",
      ];
      return parts.join("");
    },
    medicine: (m: SummaryFacts["medications"][number]) =>
      m.adherence_pct === null
        ? `${m.name}（${m.dose}）：這段時間沒有需要服用的劑量。`
        : `${m.name}（${m.dose}）：${m.adherence_pct}%（${m.doses_due} 次中服用 ${m.taken} 次，漏服 ${m.missed} 次）。`,
    mostMissed: (part: string, n: number, total: number) => `漏服最多在${part}（${total} 次中佔 ${n} 次）。`,
    evening: (e: SummaryFacts["evening_doses_weekday_vs_weekend"]) =>
      `晚上劑量：平日 ${e.weekday_doses} 次中漏服 ${e.weekday_missed} 次，週末 ${e.weekend_doses} 次中漏服 ${e.weekend_missed} 次。`,
    gap: (g: SummaryFacts["gaps_over_24h_without_any_dose_taken"][number]) =>
      `由 ${g.from} 至 ${g.to}（約 ${g.hours} 小時）沒有任何已服用的紀錄。`,
    double: (d: SummaryFacts["possible_double_doses"][number]) =>
      `${d.medicine} 在 ${d.date}（${d.scheduled_time}）被確認多於一次：${d.confirmations
        .map((c) =>
          c
            .replace(/(\d{2}:\d{2}) by patient/, "$1 病人確認")
            .replace(/(\d{2}:\d{2}) by caregiver/, "$1 照顧者確認")
            .replace(/(\d{2}:\d{2}) by voice/, "$1 病人以語音確認")
            .replace(/(\d{2}:\d{2}) by auto/, "$1 系統記錄")
        )
        .join("、")}。`,
    byCaregiver: (n: number, total: number) => `${total} 次已服用的劑量中，有 ${n} 次由照顧者而非病人確認。`,
    byVoice: (n: number) => `有 ${n} 次以語音確認。`,
    askRoutine: (part: string) => `病人可否講講自己${part}的日常習慣？`,
    askDouble: "有其他人幫手時，病人如何記住自己有沒有服藥？",
    askGap: (g: SummaryFacts["gaps_over_24h_without_any_dose_taken"][number]) =>
      `由 ${g.from} 至 ${g.to} 沒有紀錄，期間發生了甚麼事？`,
    askNotes: "病人想不想談談照顧者備註中提到的事情？",
    limits: [
      "資料來自病人和照顧者的紀錄，未經獨立核實。",
      "記錄為已服用只代表有人按了確認，不能證明藥物已經服下。",
    ],
    simulated: "部分藥物來自示範用的模擬醫院紀錄。",
    automatic: "由於人工智能服務未能使用，這份摘要由系統根據數字自動撰寫。",
  },
};

export function buildFallbackSummary(f: SummaryFacts, lang: "en" | "zh"): AiSummary {
  const T = TEXT[lang];
  const missedTotal = f.overall.missed;

  // Time of day with the most missed doses
  const byPart = Object.entries(f.missed_by_time_of_day) as [Part, number][];
  const [topPart, topCount] = byPart.sort((a, b) => b[1] - a[1])[0] ?? ["morning", 0];

  const patterns: string[] = [];
  if (missedTotal > 0 && topCount > 0) patterns.push(T.mostMissed(T.part[topPart], topCount, missedTotal));
  const e = f.evening_doses_weekday_vs_weekend;
  if (e.weekday_doses + e.weekend_doses > 0) patterns.push(T.evening(e));
  for (const g of f.gaps_over_24h_without_any_dose_taken) patterns.push(T.gap(g));

  const discrepancies: string[] = f.possible_double_doses.map(T.double);
  if (f.confirmed_by.caregiver > 0) discrepancies.push(T.byCaregiver(f.confirmed_by.caregiver, f.overall.taken));
  if (f.confirmed_by.patient_voice > 0) discrepancies.push(T.byVoice(f.confirmed_by.patient_voice));

  const topics: string[] = [];
  if (missedTotal > 0 && topCount > 0) topics.push(T.askRoutine(T.part[topPart]));
  if (f.possible_double_doses.length > 0) topics.push(T.askDouble);
  if (f.gaps_over_24h_without_any_dose_taken[0]) topics.push(T.askGap(f.gaps_over_24h_without_any_dose_taken[0]));
  if (f.caregiver_notes.length > 0) topics.push(T.askNotes);

  const limits = [...T.limits];
  if (f.medications.some((m) => m.source === "hospital_record_simulated")) limits.push(T.simulated);
  limits.push(T.automatic);

  return {
    overview: T.overview(f),
    adherence_by_medicine: f.medications.map(T.medicine),
    patterns_observed: patterns,
    possible_discrepancies: discrepancies,
    caregiver_observations: f.caregiver_notes.map((n) => `${n.date}: ${n.note}`),
    suggested_topics_to_discuss: topics,
    data_limitations: limits,
  };
}
