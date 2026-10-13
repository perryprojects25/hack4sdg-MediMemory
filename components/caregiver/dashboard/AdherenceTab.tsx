"use client";

// Adherence: this week's %, a 4-week calendar heatmap, and a bar per medicine.
// All numbers are computed in code from the logs (lib/adherence.ts).

import { useLanguage } from "@/lib/language";
import { adherenceByDay, adherenceByMedicine, adherencePct } from "@/lib/adherence";
import { lastDays, weekdayOf } from "@/lib/doses";
import { Card } from "@/components/ui";
import AdherenceBarChart, { chartLabel } from "@/components/AdherenceBarChart";
import type { PatientData } from "./usePatientData";

// Sequential teal scale: darker = more doses taken.
function cellStyle(pct: number | null) {
  if (pct === null) return "border-2 border-dashed border-slate-300 bg-white text-slate-500";
  if (pct >= 90) return "bg-teal-800 text-white";
  if (pct >= 75) return "bg-teal-600 text-white";
  if (pct >= 50) return "bg-teal-300 text-slate-900";
  return "bg-teal-100 text-slate-900";
}

export default function AdherenceTab({ data }: { data: PatientData }) {
  const { t, lang } = useLanguage();
  const week = lastDays(7, data.loadedAt);
  const weekDoses = data.doses.filter((d) => week.includes(d.date));
  const weekPct = adherencePct(weekDoses);
  const weekResolved = weekDoses.filter((d) => d.status === "taken" || d.status === "missed" || d.status === "skipped");
  const weekTaken = weekResolved.filter((d) => d.status === "taken").length;

  // Heatmap: last 28 days, laid out Sunday..Saturday.
  const days = adherenceByDay(data.doses, data.dates);
  const leadingBlanks = weekdayOf(data.dates[0]);
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2023, 0, 1 + i)) // 1 Jan 2023 was a Sunday
    )
  );

  const perMed = adherenceByMedicine(weekDoses)
    .filter((m) => m.pct !== null)
    .map((m) => ({
      name: chartLabel(m.name),
      pct: m.pct!,
      detail: `${m.name}: ${t("barDetail", { taken: m.taken, total: m.scheduled })}`,
    }));

  return (
    <div className="flex flex-col gap-6">
      {/* Headline number */}
      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("adhWeekTitle")}</h2>
        {weekPct === null ? (
          <p className="mt-2 text-lg text-slate-700">{t("adhNoData")}</p>
        ) : (
          <>
            <p className="mt-2 text-6xl font-bold text-slate-900">{weekPct}%</p>
            <p className="mt-1 text-lg text-slate-700">
              {t("adhWeekDetail", { taken: weekTaken, total: weekResolved.length })}
            </p>
          </>
        )}
      </Card>

      {/* Calendar heatmap */}
      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("adhCalendarTitle")}</h2>
        <p className="mt-1 text-base text-slate-700">{t("adhCalendarHint")}</p>
        <div className="mt-4 grid max-w-xl grid-cols-7 gap-1.5" role="table" aria-label={t("adhCalendarTitle")}>
          {weekdayNames.map((name) => (
            <div key={name} className="text-center text-sm font-semibold text-slate-700" role="columnheader">
              {name}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const label = new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            }).format(new Date(`${day.date}T00:00:00Z`));
            const summary =
              day.pct === null ? `${label}: ${t("adhNoDoses")}` : `${label}: ${day.pct}% (${day.taken}/${day.total})`;
            return (
              <div
                key={day.date}
                role="cell"
                title={summary}
                aria-label={summary}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs sm:text-sm ${cellStyle(day.pct)}`}
              >
                <span className="font-semibold">{Number(day.date.slice(8))}</span>
                <span>{day.pct === null ? "–" : `${day.pct}%`}</span>
              </div>
            );
          })}
        </div>
        {/* Legend for the colour scale */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-800">
          {[
            ["bg-teal-100", "<50%"],
            ["bg-teal-300", "50–74%"],
            ["bg-teal-600", "75–89%"],
            ["bg-teal-800", "≥90%"],
          ].map(([cls, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`inline-block h-4 w-4 rounded ${cls}`} aria-hidden="true" />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded border-2 border-dashed border-slate-300" aria-hidden="true" />
            {t("adhNoDoses")}
          </span>
        </div>
      </Card>

      {/* Bar per medicine */}
      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("adhByMedTitle")}</h2>
        <p className="mt-1 text-base text-slate-700">{t("adhByMedHint")}</p>
        {perMed.length === 0 ? (
          <p className="mt-4 text-lg text-slate-700">{t("adhNoData")}</p>
        ) : (
          <div className="mt-4">
            <AdherenceBarChart data={perMed} ariaLabel={t("adhByMedTitle")} />
          </div>
        )}
      </Card>
    </div>
  );
}
