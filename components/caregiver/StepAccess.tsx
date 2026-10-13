"use client";

// Step 4: give the patient a PIN and a personal link (with QR code).
// The PIN is only saved when the caregiver presses "Finish setup".

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { Patient } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";
import {
  AccessTakenError,
  USERNAME_PATTERN,
  generatePin,
  saveAccess,
  suggestUsername,
} from "@/lib/caregiver-data";
import { Card, ErrorBox, Field, inputClass } from "@/components/ui";
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
  const [username, setUsername] = useState(() => patient.username ?? suggestUsername(patient.name));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<TranslationKey | null>(null);

  async function finish() {
    if (!USERNAME_PATTERN.test(username)) {
      setProblem("errUsername");
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const updated = await saveAccess(patient.id, username, pin);
      data.onFinished(updated);
    } catch (err) {
      console.error(err);
      setProblem(err instanceof AccessTakenError ? "errAccessTaken" : "genericError");
      setSaving(false);
    }
  }

  return (
    <Card>
      <h1 className="text-3xl font-bold text-slate-900">{t("s4Title")}</h1>
      <p className="mt-2 text-xl text-slate-800">{t("s4Intro")}</p>

      <div className="mt-6">
        <Field label={t("s4ChooseUsername")} hint={t("s4UsernameHint")}>
          {(props) => (
            <input
              {...props}
              className={`${inputClass} max-w-sm font-mono`}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20))}
              autoCapitalize="none"
              autoCorrect="off"
            />
          )}
        </Field>
      </div>

      <div className="mt-6">
        <PatientAccess patientId={patient.id} username={username} pin={pin} onNewPin={() => setPin(generatePin())} />
      </div>

      {problem && (
        <div className="mt-6">
          <ErrorBox>{t(problem)}</ErrorBox>
        </div>
      )}

      <WizardNav onBack={onBack} onNext={finish} nextLabel={t("s4Finish")} busy={saving} />
    </Card>
  );
}
