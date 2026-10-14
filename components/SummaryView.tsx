"use client";

// Renders a doctor summary: disclaimer, AI-written sections, adherence chart,
// medicine list (with where each came from) and the raw log to verify against.
// Used for the caregiver's preview and on the doctor's read-only page.

import { useLanguage } from "@/lib/language";
import type { SummaryContent } from "@/lib/summary";
import type { TranslationKey } from "@/lib/translations";
import { formatTime } from "@/lib/time";
import PillIcon from "@/components/PillIcon";
import AdherenceBarChart, { chartLabel } from "@/components/AdherenceBarChart";

const SECTIONS: { key: keyof SummaryContent["summary"]; titleKey: TranslationKey }[] = [
  { key: "adherence_by_medicine", titleKey: "sumAdherence" },
  { key: "patterns_observed", titleKey: "sumPatterns" },
  { key: "possible_discrepancies", titleKey: "sumDiscrepancies" },
  { key: "caregiver_observations", titleKey: "sumObservations" },
  { key: "suggested_topics_to_discuss", titleKey: "sumTopics" },
  { key: "data_limitations", titleKey: "sumLimitations" },
];

const STATUS_KEY: Record<string, TranslationKey> = {
  taken: "stTaken",
  late: "stLate",
  missed: "stMissed",
  snoozed: "stSnoozed",
  skipped: "stSkipped",
};
const BY_KEY: Record<string, TranslationKey> = {
  patient: "byPatient",
  caregiver: "byCaregiver",
  voice: "byVoice",
  auto: "byAuto",
};

export default function SummaryView({ content }: { content: SummaryContent }) {
  const { t, lang } = useLanguage();
  const { facts, summary } = content;

  const fmtDate = (date: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  const fmtDateTime = (iso: string) =>
    `${new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(iso))} ${formatTime(iso, lang)}`;

  const chartData = facts.medications
    .filter((m) => m.adherence_pct !== null)
    .map((m) => ({
      name: chartLabel(m.name),
      pct: m.adherence_pct!,
      detail: `${m.name}: ${t("barDetail", { taken: m.taken, total: m.doses_due })}`,
    }));

  return (
    <article className="flex flex-col gap-6 text-slate-900">
      {/* Required disclaimer */}
      <p className="rounded-xl border-2 border-slate-700 bg-slate-50 p-3 text-base font-semibold">
        ⚕️ {t("doctorDisclaimer")}
      </p>

      <header>
        <h1 className="text-3xl font-bold">{t("sumTitle")}</h1>
        <p className="mt-1 text-lg text-slate-800">
          {content.patient.name}
          {content.patient.age ? ` · ${t("homeAge", { age: content.patient.age })}` : ""} ·{" "}
          {fmtDate(content.period.start)} – {fmtDate(content.period.end)}
        </p>
        <p className="text-sm text-slate-700">
          {t("sumGenerated", { time: fmtDateTime(content.generatedAt) })}
        </p>
        {/* Who wrote it: the AI, or the built-in fallback when the AI was unavailable */}
        <p
          className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
            content.writtenBy === "automatic" ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-800"
          }`}
        >
          {content.writtenBy === "automatic" ? t("sumWrittenAuto") : t("sumWrittenAi")}
        </p>
      </header>

      <section>
        <h2 className="text-xl font-bold">{t("sumOverview")}</h2>
        <p className="mt-2 text-lg leading-relaxed">{summary.overview}</p>
        {facts.overall.adherence_pct !== null && (
          <p className="mt-2 text-lg">
            <strong>{t("sumOverall")}:</strong> {facts.overall.adherence_pct}% (
            {t("barDetail", { taken: facts.overall.taken, total: facts.overall.doses_due })})
          </p>
        )}
      </section>

      {chartData.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="text-xl font-bold">{t("adhByMedTitle")}</h2>
          <div className="mt-2 max-w-2xl">
            <AdherenceBarChart data={chartData} ariaLabel={t("adhByMedTitle")} />
          </div>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="text-xl font-bold">{t("sumMedicines")}</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {content.medications.map((m) => (
            <li key={m.name} className="flex items-center gap-3 rounded-xl border border-slate-300 p-3">
              <PillIcon shape={m.shape} color={m.color} size={36} />
              <div className="flex-1">
                <p className="font-semibold">
                  {m.name} <span className="font-normal">· {m.dose}</span>
                  {!m.active && <span className="ml-2 text-sm">({t("medPaused")})</span>}
                </p>
                <p className="text-sm text-slate-700">
                  {t("timesLabel")}: {m.times.join(", ")}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  m.source === "hospital_record_simulated"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.source === "hospital_record_simulated"
                  ? `🏥 ${t("s3FromHospital")} · ${t("simulatedShort")}`
                  : `✍️ ${t("sumFromCaregiver")}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {SECTIONS.map(({ key, titleKey }) => (
        <section key={key} className="break-inside-avoid">
          <h2 className="text-xl font-bold">{t(titleKey)}</h2>
          {summary[key].length === 0 ? (
            <p className="mt-2 text-lg text-slate-700">{t("sumNone")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-6 text-lg leading-relaxed">
              {(summary[key] as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* Raw log so the doctor can verify the AI's statements */}
      <details className="raw-log rounded-xl border-2 border-slate-300 p-3">
        <summary className="cursor-pointer text-lg font-bold">
          {t("sumRawLog", { n: content.rawLog.length })}
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-slate-400">
                <th className="py-1 pr-3">{t("rawScheduled")}</th>
                <th className="py-1 pr-3">{t("rawMedicine")}</th>
                <th className="py-1 pr-3">{t("rawStatus")}</th>
                <th className="py-1 pr-3">{t("rawLoggedAt")}</th>
                <th className="py-1">{t("rawBy")}</th>
              </tr>
            </thead>
            <tbody>
              {content.rawLog.map((row, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-1 pr-3 whitespace-nowrap">{fmtDateTime(row.scheduledFor)}</td>
                  <td className="py-1 pr-3">{row.medicine}</td>
                  <td className="py-1 pr-3">{STATUS_KEY[row.status] ? t(STATUS_KEY[row.status]) : row.status}</td>
                  <td className="py-1 pr-3 whitespace-nowrap">{fmtDateTime(row.loggedAt)}</td>
                  <td className="py-1">{BY_KEY[row.loggedBy] ? t(BY_KEY[row.loggedBy]) : row.loggedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
