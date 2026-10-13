"use client";

// Shown once setup is finished. The full dashboard replaces most of this in Step 6.

import { useLanguage } from "@/lib/language";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Caregiver, Medication, Patient } from "@/lib/types";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import MedicineList from "./MedicineList";
import PatientAccess from "./PatientAccess";

export default function CaregiverHome({
  caregiver,
  patient,
  medications,
  onEdit,
}: {
  caregiver: Caregiver;
  patient: Patient;
  medications: Medication[];
  onEdit: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-green-700 bg-green-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">✅ {t("homeAllSet")}</h1>
            <p className="mt-2 text-xl text-slate-800">
              {t("homeAllSetText", { name: patient.name })}
            </p>
            <p className="mt-2 text-lg text-slate-800">
              {patient.name}
              {patient.age ? ` · ${t("homeAge", { age: patient.age })}` : ""} ·{" "}
              {patient.preferred_language === "zh" ? t("langZh") : t("langEn")}
            </p>
          </div>
          <SecondaryButton onClick={() => getSupabaseBrowser().auth.signOut()}>
            {t("signOut")}
          </SecondaryButton>
        </div>
        <p className="mt-4 text-base text-slate-700">{t("s1SignedInAs", { email: caregiver.email })}</p>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">💊 {t("homeMedicines")}</h2>
        <div className="mt-4">
          <MedicineList medications={medications} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">📱 {t("homeAccess")}</h2>
        <PatientAccess patientId={patient.id} pin={patient.pin!} />
      </Card>

      <PrimaryButton className="self-start" onClick={onEdit}>
        ✏️ {t("homeEdit")}
      </PrimaryButton>
    </div>
  );
}
