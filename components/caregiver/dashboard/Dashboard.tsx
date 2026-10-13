"use client";

// Caregiver dashboard: patient switcher, missed-dose alert, and the tabs.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { selectPatient } from "@/lib/caregiver-data";
import { DEMO_MARK } from "@/lib/demo-data";
import { formatTime } from "@/lib/time";
import type { Caregiver, Patient } from "@/lib/types";
import { ErrorBox, SecondaryButton } from "@/components/ui";
import { usePatientData } from "./usePatientData";
import TodayTab from "./TodayTab";
import AdherenceTab from "./AdherenceTab";
import MedicinesTab from "./MedicinesTab";
import NotesTab from "./NotesTab";
import SummaryTab from "./SummaryTab";
import SettingsTab from "./SettingsTab";

const TABS: { id: string; icon: string; labelKey: TranslationKey }[] = [
  { id: "today", icon: "📅", labelKey: "tabToday" },
  { id: "adherence", icon: "📊", labelKey: "tabAdherence" },
  { id: "medicines", icon: "💊", labelKey: "tabMedicines" },
  { id: "notes", icon: "📝", labelKey: "tabNotes" },
  { id: "summary", icon: "🩺", labelKey: "tabSummary" },
  { id: "settings", icon: "⚙️", labelKey: "tabSettings" },
];

const DAY = 24 * 60 * 60 * 1000;

export default function Dashboard({
  caregiver,
  patients,
  patient,
  onEdit,
  onPatientChanged,
  onEverythingChanged,
}: {
  caregiver: Caregiver;
  patients: Patient[];
  patient: Patient;
  onEdit: () => void;
  onPatientChanged: (patient: Patient) => void;
  onEverythingChanged: () => Promise<void>;
}) {
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState("today");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { data, failed, reload } = usePatientData(patient);

  // Red alert: doses missed in the last 24 hours (not yet dismissed).
  const missed =
    data?.doses.filter(
      (d) =>
        d.status === "missed" &&
        data.loadedAt.getTime() - new Date(d.scheduledFor).getTime() < DAY &&
        !dismissed.has(`${d.med.id}-${d.scheduledFor}`)
    ) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header with patient switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg text-slate-700">{t("dashCaring", { name: caregiver.name })}</p>
          <h1 className="text-3xl font-bold text-slate-900">{patient.name}</h1>
        </div>
        {patients.length > 1 && (
          <label className="flex flex-col text-base font-semibold text-slate-800">
            {t("dashSwitch")}
            <select
              value={patient.id}
              onChange={async (e) => {
                selectPatient(e.target.value);
                await onEverythingChanged();
              }}
              className="mt-1 min-h-12 rounded-xl border-2 border-slate-400 bg-white px-3 text-lg text-slate-900"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.notes === DEMO_MARK ? ` (${t("demoTag")})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {missed.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-red-700 bg-red-50 p-4 text-red-950">
          <p className="text-xl font-bold">🚨 {t("alertMissed", { n: missed.length })}</p>
          <ul className="mt-2 list-disc pl-6 text-lg">
            {missed.slice(0, 5).map((d) => (
              <li key={`${d.med.id}-${d.scheduledFor}`}>
                {d.med.name} · {formatTime(d.scheduledFor, lang)}
                {d.date !== data!.dates.at(-1) ? ` (${t("alertYesterday")})` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-base">{t("alertHint")}</p>
          <SecondaryButton
            className="mt-3 min-h-12 text-lg"
            onClick={() =>
              setDismissed(new Set([...dismissed, ...missed.map((d) => `${d.med.id}-${d.scheduledFor}`)]))
            }
          >
            {t("alertDismiss")}
          </SecondaryButton>
          {/* TODO: also email the caregiver when a dose is missed (needs an email service such as Resend). */}
        </div>
      )}

      {/* Tabs (scroll sideways on small phones) */}
      <div role="tablist" aria-label={t("dashTabs")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-12 shrink-0 rounded-full border-2 px-4 text-lg font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 ${
              tab === item.id
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span aria-hidden="true">{item.icon}</span> {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {failed && !data && <ErrorBox>{t("genericError")}</ErrorBox>}
        {!data && !failed && (
          <p role="status" className="text-xl text-slate-800">
            {t("loading")}
          </p>
        )}
        {data && tab === "today" && <TodayTab patient={patient} data={data} reload={reload} />}
        {data && tab === "adherence" && <AdherenceTab data={data} />}
        {data && tab === "medicines" && <MedicinesTab patient={patient} data={data} reload={reload} />}
        {data && tab === "notes" && <NotesTab patient={patient} data={data} reload={reload} />}
        {tab === "summary" && <SummaryTab patient={patient} />}
        {tab === "settings" && (
          <SettingsTab
            caregiver={caregiver}
            patient={patient}
            hasDemo={patients.some((p) => p.notes === DEMO_MARK)}
            onEdit={onEdit}
            onPatientChanged={onPatientChanged}
            onEverythingChanged={onEverythingChanged}
            reload={reload}
          />
        )}
      </div>
    </div>
  );
}
