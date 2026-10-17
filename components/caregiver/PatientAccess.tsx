"use client";

// Shows how the patient signs in: their username and 4-digit PIN.

import { useLanguage } from "@/lib/language";
import { SecondaryButton } from "@/components/ui";

export default function PatientAccess({
  username,
  pin,
  onNewPin,
}: {
  username: string;
  pin: string;
  onNewPin?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-2xl border-2 border-teal-700 bg-teal-50 p-4 text-lg text-slate-900">
        🏠 {t("s4LoginHint")}
      </p>

      <div>
        <h3 className="text-xl font-semibold text-slate-900">{t("s4Username")}</h3>
        <p className="mt-2 font-mono text-4xl font-bold text-slate-900">{username || "—"}</p>
      </div>

      <div>
        <h3 className="text-xl font-semibold text-slate-900">{t("s4Pin")}</h3>
        <p
          className="mt-2 font-mono text-6xl font-bold tracking-[0.3em] text-slate-900"
          aria-label={pin.split("").join(" ")}
        >
          {pin}
        </p>
        {onNewPin && (
          <SecondaryButton className="mt-3" onClick={onNewPin}>
            🔄 {t("s4NewPin")}
          </SecondaryButton>
        )}
      </div>

      <div className="rounded-2xl border-2 border-teal-700 bg-teal-50 p-4">
        <p className="text-lg font-semibold text-slate-900">📱 {t("s4HowTo")}</p>
        <ol className="mt-2 list-decimal pl-6 text-lg text-slate-800">
          <li>{t("s4Step1")}</li>
          <li>{t("s4Step2")}</li>
          <li>{t("s4Step3")}</li>
        </ol>
      </div>
    </div>
  );
}
