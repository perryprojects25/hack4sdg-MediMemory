"use client";

// Medicines: list, add, edit, pause and delete. Shows the storage note clearly,
// a rule-based duplicate warning, and the SIMULATED prescription sync.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import {
  addMedication,
  deleteMedication,
  setMedicationActive,
  syncHospitalDemo,
  updateMedication,
} from "@/lib/caregiver-data";
import { findDuplicates } from "@/lib/duplicates";
import { colorOption, shapeOption, shortTime } from "@/lib/medicine-options";
import type { Medication, Patient } from "@/lib/types";
import PillIcon from "@/components/PillIcon";
import { Card, ErrorBox, PrimaryButton, SecondaryButton } from "@/components/ui";
import MedicineForm from "../MedicineForm";
import type { PatientData } from "./usePatientData";

export default function MedicinesTab({
  patient,
  data,
  reload,
}: {
  patient: Patient;
  data: PatientData;
  reload: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);

  const meds = data.medications;
  const duplicates = findDuplicates(meds);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setProblem(false);
    try {
      await action();
      await reload();
    } catch (err) {
      console.error(err);
      setProblem(true);
    }
    setBusyId(null);
  }

  function remove(med: Medication) {
    if (!window.confirm(t("medDeleteConfirm", { name: med.name }))) return;
    run(med.id, () => deleteMedication(med.id));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Gentle, rule-based duplicate warning. No diagnosis, no advice. */}
      {duplicates.map(({ a, b }) => (
        <div
          key={`${a.id}-${b.id}`}
          role="alert"
          className="rounded-2xl border-2 border-amber-600 bg-amber-50 p-4 text-lg text-amber-950"
        >
          <p className="font-bold">⚠️ {t("dupTitle")}</p>
          <p className="mt-1">
            <strong>{a.name}</strong> + <strong>{b.name}</strong>
          </p>
          <p className="mt-1">{t("dupText")}</p>
        </div>
      ))}

      <PrescriptionSyncCard patient={patient} meds={meds} reload={reload} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">{t("medsTitle", { n: meds.length })}</h2>
          {!adding && (
            <PrimaryButton onClick={() => setAdding(true)}>+ {t("s3AddMedicine")}</PrimaryButton>
          )}
        </div>
        {problem && (
          <div className="mt-4">
            <ErrorBox>{t("genericError")}</ErrorBox>
          </div>
        )}

        {adding && (
          <div className="mt-4">
            <MedicineForm
              onSave={async (med) => {
                await addMedication(patient.id, { ...med, source: "manual" });
                await reload();
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {meds.length === 0 ? (
          <p className="mt-4 text-lg text-slate-700">{t("s3NoneYet")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {meds.map((med) =>
              editingId === med.id ? (
                <li key={med.id}>
                  <MedicineForm
                    initial={med}
                    onSave={async (changes) => {
                      await updateMedication(med.id, changes);
                      await reload();
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li
                  key={med.id}
                  className={`flex flex-col gap-4 rounded-2xl border-2 p-4 sm:flex-row sm:items-start ${
                    med.active ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-100"
                  }`}
                >
                  <PillIcon
                    shape={med.shape}
                    color={med.color}
                    size={56}
                    label={`${t(colorOption(med.color).labelKey)} ${t(shapeOption(med.shape).labelKey)}`}
                  />
                  <div className="flex-1">
                    <p className="text-xl font-bold text-slate-900">
                      {med.name}
                      {!med.active && (
                        <span className="ml-2 rounded-full bg-slate-700 px-3 py-0.5 align-middle text-sm font-semibold text-white">
                          ⏸ {t("medPaused")}
                        </span>
                      )}
                    </p>
                    <p className="text-lg text-slate-800">{med.dose}</p>
                    <p className="text-lg text-slate-800">
                      {t("timesLabel")}:{" "}
                      <strong>{med.schedules.map((s) => shortTime(s.time_of_day)).join(", ")}</strong>
                    </p>
                    {med.instructions && <p className="text-base text-slate-700">{med.instructions}</p>}
                    {/* Storage note, shown clearly */}
                    <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-base text-sky-950">
                      🧊 <strong>{t("storageLabel")}:</strong> {med.storage_note || t("medNoStorage")}
                    </p>
                    {med.source === "HA_demo" && (
                      <span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                        🏥 {t("s3FromHospital")} · {t("simulatedShort")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-col">
                    <SecondaryButton onClick={() => setEditingId(med.id)} disabled={busyId === med.id} className="min-h-12 text-lg">
                      ✏️ {t("medEdit")}
                    </SecondaryButton>
                    <SecondaryButton
                      onClick={() => run(med.id, () => setMedicationActive(med.id, !med.active))}
                      disabled={busyId === med.id}
                      className="min-h-12 text-lg"
                    >
                      {med.active ? `⏸ ${t("medPause")}` : `▶ ${t("medResume")}`}
                    </SecondaryButton>
                    <button
                      type="button"
                      onClick={() => remove(med)}
                      disabled={busyId === med.id}
                      className="min-h-12 rounded-full border-2 border-red-700 px-5 text-lg font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
                    >
                      🗑 {t("s3Remove")}
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

// "Prescription sync (demo)": imports the SIMULATED hospital prescription.
function PrescriptionSyncCard({
  patient,
  meds,
  reload,
}: {
  patient: Patient;
  meds: Medication[];
  reload: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  async function sync() {
    setSyncing(true);
    setFailed(false);
    try {
      setResult(await syncHospitalDemo(patient.id, meds));
      await reload();
    } catch (err) {
      console.error(err);
      setFailed(true);
    }
    setSyncing(false);
  }

  return (
    <Card className="border-amber-400 bg-amber-50">
      <h2 className="text-2xl font-bold text-slate-900">🏥 {t("syncTitle")}</h2>
      <p className="mt-2 text-lg text-slate-800">{t("syncText")}</p>
      <p className="mt-3 rounded-xl border-2 border-amber-600 bg-white p-3 text-base font-semibold text-amber-900">
        ⚠️ {t("simulatedLabel")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <SecondaryButton onClick={sync} disabled={syncing}>
          {syncing ? t("s3Importing") : `🔄 ${t("syncNow")}`}
        </SecondaryButton>
        {result !== null && (
          <p role="status" className="text-lg font-semibold text-slate-900">
            {result === 0 ? t("syncUpToDate") : t("syncAdded", { n: result })}
          </p>
        )}
      </div>
      {failed && (
        <div className="mt-4">
          <ErrorBox>{t("genericError")}</ErrorBox>
        </div>
      )}
    </Card>
  );
}
