"use client";

// Step 3: add medicines, either by hand or from the SIMULATED hospital record.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import type { Medication, Patient } from "@/lib/types";
import {
  addMedication,
  deleteMedication,
  importHospitalDemo,
  loadMedications,
} from "@/lib/caregiver-data";
import { Card, ErrorBox, SecondaryButton } from "@/components/ui";
import MedicineForm from "./MedicineForm";
import MedicineList from "./MedicineList";
import { WizardNav, type WizardData } from "./Wizard";

export default function StepMedicines({
  data,
  patient,
  onBack,
  onNext,
}: {
  data: WizardData;
  patient: Patient;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();
  const [importing, setImporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<TranslationKey | null>(null);

  const meds = data.medications;
  const alreadyImported = meds.some((m) => m.source === "HA_demo");

  async function refresh() {
    data.setMedications(await loadMedications(patient.id));
  }

  async function runImport() {
    setImporting(true);
    setProblem(null);
    try {
      await importHospitalDemo(patient.id);
    } catch (err) {
      console.error(err);
      setProblem("genericError");
    }
    await refresh().catch(() => {});
    setImporting(false);
  }

  async function remove(med: Medication) {
    setRemovingId(med.id);
    setProblem(null);
    try {
      await deleteMedication(med.id);
      await refresh();
    } catch (err) {
      console.error(err);
      setProblem("genericError");
    }
    setRemovingId(null);
  }

  function next() {
    if (meds.length === 0) {
      setProblem("s3NeedOne");
      return;
    }
    onNext();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("s3Title")}</h1>
        <p className="mt-2 text-xl text-slate-800">{t("s3Intro")}</p>
      </div>

      {/* The two ways to add medicines, side by side on larger screens */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <MedicineForm
          onSave={async (med) => {
            await addMedication(patient.id, { ...med, source: "manual" });
            await refresh();
          }}
        />

        <Card className="border-amber-400 bg-amber-50">
          <h2 className="text-2xl font-bold text-slate-900">🏥 {t("s3Import")}</h2>
          <p className="mt-2 text-lg text-slate-800">{t("s3ImportText")}</p>
          <p className="mt-4 rounded-xl border-2 border-amber-600 bg-white p-3 text-base font-semibold text-amber-900">
            ⚠️ {t("simulatedLabel")}
          </p>
          {alreadyImported ? (
            <p className="mt-4 text-lg font-semibold text-green-800" role="status">
              ✅ {t("s3Imported")}
            </p>
          ) : (
            <SecondaryButton className="mt-4 w-full" onClick={runImport} disabled={importing}>
              {importing ? t("s3Importing") : t("s3ImportButton")}
            </SecondaryButton>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("s3Added", { n: meds.length })}</h2>
        <div className="mt-4">
          {meds.length === 0 ? (
            <p className="text-lg text-slate-700">{t("s3NoneYet")}</p>
          ) : (
            <MedicineList medications={meds} onRemove={remove} removingId={removingId} />
          )}
        </div>
        {problem && (
          <div className="mt-4">
            <ErrorBox>{t(problem)}</ErrorBox>
          </div>
        )}
        <WizardNav onBack={onBack} onNext={next} />
      </Card>
    </div>
  );
}
