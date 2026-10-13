"use client";

// One dose, big and picture-based, with two main buttons:
// green "I took it" and amber "Remind me later". It is read aloud when it appears.

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import { MAX_SNOOZES } from "@/lib/dose-rules";
import { colorOption, shapeOption } from "@/lib/medicine-options";
import type { Dose } from "@/lib/patient-server";
import { canListen, speak, startListening } from "@/lib/speech";
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
  onTaken: (viaVoice: boolean) => void;
  onSnooze: () => void;
}) {
  const { t, lang } = useLanguage();
  const [listening, setListening] = useState(false);
  const [notUnderstood, setNotUnderstood] = useState(false);
  const [pressed, setPressed] = useState<"taken" | "snooze" | null>(null); // shows "Saving…" on that button

  // "White round tablet" / "白色圓形藥丸"
  const color = t(colorOption(dose.color).labelKey);
  const shape = t(shapeOption(dose.shape).labelKey);
  const pill = lang === "zh" ? `${color}${shape}` : `${color} ${shape.toLowerCase()}`;
  const spokenText = t("pSpokenDose", { name: dose.name, dose: dose.dose, pill });
  const canSnooze = dose.snoozeCount < MAX_SNOOZES;

  // Read the reminder aloud when this dose appears.
  // (Browsers may block this until the person has tapped the page once; "Read again" always works.)
  useEffect(() => {
    speak(spokenText, lang);
  }, [spokenText, lang]);

  function listen() {
    setNotUnderstood(false);
    setListening(true);
    startListening(lang, {
      onYes: () => {
        setPressed("taken");
        onTaken(true);
      },
      onNotUnderstood: () => setNotUnderstood(true),
      onEnd: () => setListening(false),
    });
  }

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
            onTaken(false);
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

        {/* Optional helpers: read aloud again, and answer by voice */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => speak(spokenText, lang)}
            className="min-h-16 flex-1 rounded-3xl border-2 border-slate-500 bg-white text-2xl font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
          >
            🔊 {t("pReadAgain")}
          </button>
          {canListen() && (
            <button
              type="button"
              onClick={listen}
              disabled={listening || busy}
              className="min-h-16 flex-1 rounded-3xl border-2 border-slate-500 bg-white text-2xl font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 disabled:bg-teal-50"
            >
              🎤 {listening ? t("pListening") : t("pSayYes")}
            </button>
          )}
        </div>
        {notUnderstood && (
          <p role="status" className="text-2xl text-slate-900">
            {t("pNotUnderstood")}
          </p>
        )}
      </div>
    </Center>
  );
}
