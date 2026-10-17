"use client";

// Opened by tapping a medicine in today's list. One medicine, big, and only the
// choices that are safe for its state:
// - taken: shows when; "I pressed this by mistake" only for a few minutes afterwards
// - not time yet: "I took it" from up to an hour before, otherwise "I'll remind you then"
// - not taken (missed): "I already took it", to record it; it never says "take it now"

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { Dose } from "@/lib/patient-server";
import { formatTime } from "@/lib/time";
import PillIcon from "@/components/PillIcon";
import { Center } from "./Screens";

const bigButton = "min-h-20 w-full rounded-3xl text-3xl font-bold focus:outline-none focus-visible:ring-4 disabled:opacity-60";

export default function DoseDetailScreen({
  dose,
  busy,
  onTaken,
  onUndo,
  onBack,
}: {
  dose: Dose;
  busy: boolean;
  onTaken: () => void;
  onUndo: () => void;
  onBack: () => void;
}) {
  const { t, lang } = useLanguage();
  const [confirmingUndo, setConfirmingUndo] = useState(false);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className={`${bigButton} border-4 border-slate-500 bg-white text-slate-900 hover:bg-slate-100 focus-visible:ring-teal-300`}
    >
      ← {t("pBack")}
    </button>
  );

  // "So you have NOT taken it?" Asked once more, because undoing a real dose could lead to a double dose.
  if (confirmingUndo) {
    return (
      <Center>
        <PillIcon shape={dose.shape} color={dose.color} size={110} />
        <h1 className="mt-4 text-4xl font-bold text-slate-900">{t("pMistakeConfirm", { name: dose.name })}</h1>
        <div className="mt-8 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            className={`${bigButton} bg-amber-400 text-slate-900 hover:bg-amber-500 focus-visible:ring-amber-200`}
          >
            {busy ? t("saving") : t("pMistakeYes")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingUndo(false)}
            className={`${bigButton} border-4 border-slate-500 bg-white text-slate-900 hover:bg-slate-100 focus-visible:ring-teal-300`}
          >
            ← {t("pBack")}
          </button>
        </div>
      </Center>
    );
  }

  const tookItButton = (label: string) => (
    <button
      type="button"
      onClick={onTaken}
      disabled={busy}
      className="min-h-24 w-full rounded-3xl bg-green-700 text-4xl font-bold text-white hover:bg-green-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 disabled:opacity-60"
    >
      {busy ? t("saving") : `✓ ${label}`}
    </button>
  );

  return (
    <Center>
      <PillIcon shape={dose.shape} color={dose.color} size={120} />
      <h1 className="mt-3 text-4xl font-bold text-slate-900">{dose.name}</h1>
      <p className="mt-1 text-3xl text-slate-900">{dose.dose}</p>
      <p className="mt-1 text-2xl text-slate-800">🕗 {formatTime(dose.scheduledFor, lang)}</p>
      {dose.instructions && <p className="mt-1 text-2xl text-slate-800">{dose.instructions}</p>}

      <div className="mt-6 flex w-full flex-col gap-3">
        {dose.status === "taken" && (
          <>
            <p className="rounded-3xl border-2 border-green-700 bg-green-50 p-4 text-2xl font-semibold text-green-900">
              ✓ {t("pAlreadyText", { time: formatTime(dose.takenAt!, lang) })}
            </p>
            {dose.canUndo ? (
              <button
                type="button"
                onClick={() => setConfirmingUndo(true)}
                className="min-h-16 w-full rounded-3xl border-2 border-slate-500 bg-white text-2xl font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
              >
                {t("pMistake")}
              </button>
            ) : (
              <p className="text-2xl text-slate-800">{t("pAskFamily")}</p>
            )}
          </>
        )}

        {dose.status === "upcoming" &&
          (dose.canTakeNow ? (
            tookItButton(t("pTookIt"))
          ) : (
            <p className="text-2xl text-slate-900">🕗 {t("pNotYet", { time: formatTime(dose.scheduledFor, lang) })}</p>
          ))}

        {(dose.status === "due" || dose.status === "snoozed") && tookItButton(t("pTookIt"))}

        {dose.status === "closed" && (
          <>
            <p className="text-2xl text-slate-900">{t("pNotMarked")}</p>
            {tookItButton(t("pAlreadyTookIt"))}
            <p className="text-2xl text-slate-800">{t("pNotSure")}</p>
          </>
        )}

        {backButton}
      </div>
    </Center>
  );
}
