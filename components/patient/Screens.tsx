"use client";

// Simple full-screen messages for the patient: success, already taken, all done, etc.

import { useEffect } from "react";
import { useLanguage } from "@/lib/language";
import type { Dose } from "@/lib/patient-server";
import { formatTime, hongKongHour } from "@/lib/time";
import PillIcon from "@/components/PillIcon";

const bigButton =
  "min-h-20 w-full rounded-3xl text-3xl font-bold focus:outline-none focus-visible:ring-4";

export function MessageScreen({
  icon,
  title,
  text,
  buttonLabel,
  onButton,
  autoCloseSeconds,
  tone = "plain",
}: {
  icon: string;
  title: string;
  text?: string;
  buttonLabel?: string;
  onButton?: () => void;
  autoCloseSeconds?: number; // go back by itself after this long
  tone?: "plain" | "green" | "blue";
}) {
  useEffect(() => {
    if (!autoCloseSeconds || !onButton) return;
    const timer = setTimeout(onButton, autoCloseSeconds * 1000);
    return () => clearTimeout(timer);
  }, [autoCloseSeconds, onButton]);

  const circle = { plain: "bg-slate-100", green: "bg-green-100", blue: "bg-sky-100" }[tone];

  return (
    <Center>
      <div
        className={`flex h-40 w-40 items-center justify-center rounded-full text-8xl ${circle}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h1 className="mt-6 text-4xl font-bold text-slate-900" role="status">
        {title}
      </h1>
      {text && <p className="mt-4 text-3xl text-slate-900">{text}</p>}
      {buttonLabel && onButton && (
        <button
          type="button"
          onClick={onButton}
          className={`${bigButton} mt-8 bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-300`}
        >
          {buttonLabel}
        </button>
      )}
    </Center>
  );
}

export function AllDoneScreen({
  patientName,
  nextTime,
  onShowTaken,
}: {
  patientName: string;
  nextTime: string | null;
  onShowTaken: () => void;
}) {
  const { t } = useLanguage();
  const greeting = hongKongHour() < 12 ? t("pGreetingMorning", { name: patientName }) : t("pGreeting", { name: patientName });

  return (
    <Center>
      <p className="text-3xl font-semibold text-slate-900">{greeting}</p>
      <div
        className="mt-6 flex h-40 w-40 items-center justify-center rounded-full bg-green-100 text-8xl"
        aria-hidden="true"
      >
        😊
      </div>
      <h1 className="mt-6 text-4xl font-bold text-slate-900">{t("pAllDone")}</h1>
      <p className="mt-4 text-3xl text-slate-900">
        {nextTime ? `🕗 ${t("pNextAt", { time: nextTime })}` : t("pNoMoreToday")}
      </p>
      <button
        type="button"
        onClick={onShowTaken}
        className={`${bigButton} mt-8 border-4 border-teal-700 bg-white text-teal-900 hover:bg-teal-50 focus-visible:ring-teal-300`}
      >
        📋 {t("pWhatTaken")}
      </button>
    </Center>
  );
}

// Answers the question the whole app is about: "Did I already take it?"
export function TakenListScreen({ doses, onBack }: { doses: Dose[]; onBack: () => void }) {
  const { t, lang } = useLanguage();

  return (
    <Center>
      <h1 className="text-4xl font-bold text-slate-900">{t("pTakenToday")}</h1>
      {doses.length === 0 ? (
        <p className="mt-6 text-3xl text-slate-900">{t("pNothingTaken")}</p>
      ) : (
        <ul className="mt-6 flex w-full flex-col gap-3 text-left">
          {doses.map((dose) => (
            <li
              key={`${dose.medicationId}-${dose.scheduledFor}`}
              className="flex items-center gap-4 rounded-3xl border-2 border-green-700 bg-green-50 p-4"
            >
              <PillIcon shape={dose.shape} color={dose.color} size={56} />
              <div>
                <p className="text-2xl font-bold text-slate-900">{dose.name}</p>
                <p className="text-2xl text-slate-900">✓ {formatTime(dose.takenAt!, lang)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onBack}
        className={`${bigButton} mt-8 bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-300`}
      >
        ← {t("pBack")}
      </button>
    </Center>
  );
}

// Centres a patient screen on the page.
export function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-6 text-center">
      {children}
    </main>
  );
}
