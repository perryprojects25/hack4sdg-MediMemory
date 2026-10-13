"use client";

// Step 4: give the patient a PIN and a personal link (with QR code).
// The PIN is only saved when the caregiver presses "Finish setup".

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { Patient } from "@/lib/types";
import { generatePin, savePin } from "@/lib/caregiver-data";
import { Card, ErrorBox } from "@/components/ui";
import PatientAccess from "./PatientAccess";
import { WizardNav, type WizardData } from "./Wizard";

export default function StepAccess({
  data,
  patient,
  onBack,
}: {
  data: WizardData;
  patient: Patient;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const [pin, setPin] = useState(() => patient.pin ?? generatePin());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function finish() {
    setSaving(true);
    setFailed(false);
    try {
      const updated = await savePin(patient.id, pin);
      data.onFinished(updated);
    } catch (err) {
      console.error(err);
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <Card>
      <h1 className="text-3xl font-bold text-slate-900">{t("s4Title")}</h1>
      <p className="mt-2 text-xl text-slate-800">{t("s4Intro")}</p>

      <div className="mt-6">
        <PatientAccess patientId={patient.id} pin={pin} onNewPin={() => setPin(generatePin())} />
      </div>

      {failed && (
        <div className="mt-6">
          <ErrorBox>{t("genericError")}</ErrorBox>
        </div>
      )}

      <WizardNav onBack={onBack} onNext={finish} nextLabel={t("s4Finish")} busy={saving} />
    </Card>
  );
}
