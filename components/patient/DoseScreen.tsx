"use client";

// One dose, big and picture-based, with two main buttons:
// green "I took it" and amber "Remind me later". A gentle chime plays when it appears.

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import { MAX_SNOOZES } from "@/lib/dose-rules";
import { colorOption, shapeOption } from "@/lib/medicine-options";
import type { Dose } from "@/lib/patient-server";
import { playChime, showNotification } from "@/lib/reminders";
import { formatTime } from "@/lib/time";
import PillIcon from "@/components/PillIcon";
import { Center } from "./Screens";

export default function DoseScreen({
  dose,
  position,
  busy,
  onTaken,
  onSnooze,
}: {
  dose: Dose;
  position: { n: number; total: number } | null;
  busy: boolean;
  onTaken: () => void;
  onSnooze: () => void;
}) {
  const { t, lang } = useLanguage();
  const [pressed, setPressed] = useState<"taken" | "snooze" | null>(null); // shows "Saving…" on that button

  // "White round tablet" / "白色圓形藥丸"
  const color = t(colorOption(dose.color).labelKey);
  const shape = t(shapeOption(dose.shape).labelKey);
  const pill = lang === "zh" ? `${color}${shape}` : `${color} ${shape.toLowerCase()}`;
  const canSnooze = dose.snoozeCount < MAX_SNOOZES;

  // When this dose appears: a gentle chime, plus a browser notification if the page is
  // in the background. (Browsers may block sound until the person has tapped the page once.)
  useEffect(() => {
    playChime();
    if (document.visibilityState !== "visible") showNotification(t("pTimeFor"), `${dose.name} · ${dose.dose}`);
    // Only when a new dose appears, not when the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dose.medicationId, dose.scheduledFor]);

  return (
    <Center>
      {position && (
        <p className="text-2xl font-semibold text-slate-800">{t("pOfCount", position)}</p>
      )}
      <p className="text-2xl font-semibold text-teal-800">{t("pTimeFor")}</p>

      <div className="mt-3">
        <PillIcon shape={dose.shape} color={dose.color} size={130} label={pill} />
      </div>
      <h1 className="mt-3 text-4xl font-bold text-slate-900">{dose.name}</h1>
      <p className="mt-1 text-3xl text-slate-900">{dose.dose}</p>
      <p className="mt-1 text-2xl text-slate-800">🕗 {formatTime(dose.scheduledFor, lang)}</p>
      {dose.instructions && <p className="mt-1 text-2xl text-slate-800">{dose.instructions}</p>}

      <div className="mt-5 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setPressed("taken");
            onTaken();
          }}
          disabled={busy}
          className="min-h-24 w-full rounded-3xl bg-green-700 text-4xl font-bold text-white hover:bg-green-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 disabled:opacity-60"
        >
          {busy && pressed === "taken" ? t("saving") : `✓ ${t("pTookIt")}`}
        </button>

        {canSnooze ? (
          <button
            type="button"
            onClick={() => {
              setPressed("snooze");
              onSnooze();
            }}
            disabled={busy}
            className="min-h-20 w-full rounded-3xl bg-amber-400 text-3xl font-bold text-slate-900 hover:bg-amber-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:opacity-60"
          >
            {busy && pressed === "snooze" ? t("saving") : `⏰ ${t("pRemindLater")}`}
          </button>
        ) : (
          <p className="text-2xl text-slate-800">{t("pLastReminder")}</p>
        )}

      </div>
    </Center>
  );
}
