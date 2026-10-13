"use client";

// The 4-step setup wizard with a progress indicator.
// Each step shows one group of questions, with Back and Next buttons.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { Caregiver, Medication, Patient } from "@/lib/types";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import StepAccount from "./StepAccount";
import StepPatient from "./StepPatient";
import StepMedicines from "./StepMedicines";
import StepAccess from "./StepAccess";

const TOTAL_STEPS = 4;

// Everything the steps need once the caregiver is signed in.
export type WizardData = {
  email: string;
  caregiver: Caregiver;
  patient: Patient | null;
  medications: Medication[];
  setPatient: (patient: Patient) => void;
  setMedications: (medications: Medication[]) => void;
  onFinished: (patient: Patient) => void;
};

export default function Wizard({
  initialStep,
  data,
  linkExpired = false,
}: {
  initialStep: number;
  data: WizardData | null; // null = not signed in yet
  linkExpired?: boolean;
}) {
  const { t } = useLanguage();
  const [step, setStep] = useState(initialStep);

  function go(to: number) {
    setStep(to);
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      {/* Progress indicator */}
      <p className="text-lg font-semibold text-teal-800">
        {t("stepOf", { n: step, total: TOTAL_STEPS })}
      </p>
      <div
        className="mt-2 flex gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-label={t("stepOf", { n: step, total: TOTAL_STEPS })}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-3 flex-1 rounded-full ${i < step ? "bg-teal-700" : "bg-slate-300"}`}
          />
        ))}
      </div>

      <div className="mt-6">
        {(step === 1 || !data) && (
          <StepAccount email={data?.email ?? null} linkExpired={linkExpired} onNext={() => go(2)} />
        )}
        {data && step === 2 && (
          <StepPatient data={data} onBack={() => go(1)} onNext={() => go(3)} />
        )}
        {data && step === 3 && data.patient && (
          <StepMedicines
            data={data}
            patient={data.patient}
            onBack={() => go(2)}
            onNext={() => go(4)}
          />
        )}
        {data && step === 4 && data.patient && (
          <StepAccess data={data} patient={data.patient} onBack={() => go(3)} />
        )}
      </div>
    </div>
  );
}

// Back / Next row shared by every step.
export function WizardNav({
  onBack,
  onNext,
  nextLabel,
  busy = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      {onBack ? (
        <SecondaryButton onClick={onBack} disabled={busy}>
          ← {t("back")}
        </SecondaryButton>
      ) : (
        <span />
      )}
      <PrimaryButton onClick={onNext} disabled={busy}>
        {busy ? t("saving") : `${nextLabel ?? t("next")} →`}
      </PrimaryButton>
    </div>
  );
}
