"use client";

// Shows the patient's username, PIN and personal link.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { SecondaryButton } from "@/components/ui";

// The patient's personal link. The PIN is checked separately on the patient screen.
export function patientLink(patientId: string): string {
  return `${window.location.origin}/patient?id=${patientId}`;
}

export default function PatientAccess({
  patientId,
  username,
  pin,
  onNewPin,
}: {
  patientId: string;
  username: string;
  pin: string;
  onNewPin?: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const link = patientLink(patientId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is still visible to copy by hand.
    }
  }

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

      <div className="min-w-0">
        <h3 className="text-xl font-semibold text-slate-900">{t("s4Link")}</h3>
        <p className="mt-1 text-base text-slate-700">{t("s4LinkOptional")}</p>
        <p className="mt-2 break-all rounded-xl bg-slate-100 p-3 font-mono text-base text-slate-900">
          {link}
        </p>
        <SecondaryButton className="mt-3" onClick={copy}>
          {copied ? `✅ ${t("s4Copied")}` : `📋 ${t("s4Copy")}`}
        </SecondaryButton>
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
