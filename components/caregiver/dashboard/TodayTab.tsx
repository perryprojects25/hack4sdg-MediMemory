"use client";

// Today: a timeline of today's doses with their status and who logged them.
// "Mark as taken" lets the caregiver record a dose the patient forgot to confirm,
// and "Mark as not taken" corrects a dose that was confirmed by mistake.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { markNotTakenByCaregiver, markTakenByCaregiver } from "@/lib/caregiver-data";
import { hongKongDate, type DoseInstance } from "@/lib/doses";
import { formatTime } from "@/lib/time";
import type { Patient } from "@/lib/types";
import PillIcon from "@/components/PillIcon";
import { Card, ErrorBox } from "@/components/ui";
import StatusChip from "./StatusChip";
import type { PatientData } from "./usePatientData";

const CAN_MARK = new Set(["due", "late", "missed", "snoozed"]);

export default function TodayTab({
  patient,
  data,
  reload,
}: {
  patient: Patient;
  data: PatientData;
  reload: () => Promise<void>;
}) {
  const { t, lang } = useLanguage();
  const [marking, setMarking] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);

  const today = hongKongDate(data.loadedAt);

  // Who confirmed a dose, in caregiver wording: their loved one's name, not "the patient".
  const who = (loggedBy: string | null) =>
    loggedBy === "caregiver"
        ? t("whoCaregiver")
        : loggedBy === "auto"
          ? t("whoApp")
          : patient.name;
  const doses = data.doses.filter((d) => d.date === today);
  const taken = doses.filter((d) => d.status === "taken").length;

  async function mark(dose: DoseInstance, taken: boolean) {
    const key = `${dose.med.id}-${dose.scheduledFor}`;
    if (
      !taken &&
      !window.confirm(
        t("markNotTakenConfirm", { med: dose.med.name, time: formatTime(dose.scheduledFor, lang), name: patient.name })
      )
    ) {
      return;
    }
    setMarking(key);
    setProblem(false);
    try {
      if (taken) await markTakenByCaregiver(patient.id, dose.med.id, dose.scheduledFor);
      else await markNotTakenByCaregiver(patient.id, dose.med.id, dose.scheduledFor);
      await reload();
    } catch (err) {
      console.error(err);
      setProblem(true);
    }
    setMarking(null);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold text-slate-900">{t("todayTitle")}</h2>
        {doses.length > 0 && (
          <p className="text-lg font-semibold text-slate-800">
            {t("todayCount", { taken, total: doses.length })}
          </p>
        )}
      </div>
      {problem && (
        <div className="mt-4">
          <ErrorBox>{t("genericError")}</ErrorBox>
        </div>
      )}

      {doses.length === 0 ? (
        <p className="mt-4 text-lg text-slate-700">{t("todayEmpty")}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {doses.map((dose) => {
            const key = `${dose.med.id}-${dose.scheduledFor}`;
            return (
              <li
                key={key}
                className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 p-4 sm:flex-row sm:items-center"
              >
                <p className="w-24 shrink-0 text-xl font-bold text-slate-900">
                  {formatTime(dose.scheduledFor, lang)}
                </p>
                <div className="flex flex-1 items-center gap-3">
                  <PillIcon shape={dose.med.shape} color={dose.med.color} size={44} />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{dose.med.name}</p>
                    <p className="text-base text-slate-700">{dose.med.dose}</p>
                    {dose.takenAt && (
                      <p className="text-base text-slate-700">
                        {t("loggedAt", {
                          time: formatTime(dose.takenAt, lang),
                          who: who(dose.takenBy),
                        })}
                      </p>
                    )}
                    {dose.takenCount > 1 && (
                      <p className="text-base font-semibold text-red-800">⚠️ {t("doubleDoseFlag")}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusChip status={dose.status} />
                  {CAN_MARK.has(dose.status) && (
                    <button
                      type="button"
                      onClick={() => mark(dose, true)}
                      disabled={marking === key}
                      className="min-h-12 rounded-full border-2 border-green-700 px-4 text-base font-semibold text-green-900 hover:bg-green-50 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300"
                    >
                      {marking === key ? t("saving") : `✓ ${t("markTaken")}`}
                    </button>
                  )}
                  {dose.status === "taken" && (
                    <button
                      type="button"
                      onClick={() => mark(dose, false)}
                      disabled={marking === key}
                      className="min-h-12 rounded-full border-2 border-slate-500 px-4 text-base font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                    >
                      {marking === key ? t("saving") : `↩ ${t("markNotTaken")}`}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
