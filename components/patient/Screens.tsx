"use client";

// Simple full-screen messages for the patient: success, already taken, all done (with today's list), etc.

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

// Shown when nothing is due: the next medicine, and today's list with what is
// already taken. It answers "Did I already take it?" at a glance, with pictures.
// Tapping a medicine opens it (DoseDetailScreen) to confirm it or correct a mistake.
export function AllDoneScreen({
  patientName,
  doses,
  onOpenDose,
  onSwitchPerson,
}: {
  patientName: string;
  doses: Dose[]; // today's doses (none of them due right now)
  onOpenDose: (dose: Dose) => void;
  onSwitchPerson: () => void;
}) {
  const { t, lang } = useLanguage();
  const greeting = hongKongHour() < 12 ? t("pGreetingMorning", { name: patientName }) : t("pGreeting", { name: patientName });

  const today = [...doses].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const takenCount = today.filter((d) => d.status === "taken").length;
  // The next one: an upcoming dose, or a snoozed one that comes back at its reminder time.
  const comingAt = (d: Dose) => (d.status === "snoozed" ? d.snoozedUntil : d.status === "upcoming" ? d.scheduledFor : null);
  const next = today
    .filter((d) => comingAt(d) !== null)
    .sort((a, b) => comingAt(a)!.localeCompare(comingAt(b)!))[0];

  function statusText(d: Dose) {
    if (d.status === "taken") return `✓ ${t("pStatusTaken", { time: formatTime(d.takenAt!, lang) })}`;
    if (d.status === "snoozed") return `⏰ ${t("pStatusSnoozed", { time: formatTime(d.snoozedUntil!, lang) })}`;
    if (d.status === "closed") return t("pStatusClosed");
    return `🕗 ${t("pStatusLater", { time: formatTime(d.scheduledFor, lang) })}`;
  }

  return (
    <Center>
      <p className="text-3xl font-semibold text-slate-900">{greeting}</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900">{t("pAllDone")}</h1>
      {today.length > 0 && (
        <p className="mt-2 text-2xl font-semibold text-green-800">✓ {t("pProgress", { n: takenCount, total: today.length })}</p>
      )}

      {/* The next medicine, big */}
      {next ? (
        <div className="mt-6 flex w-full items-center gap-4 rounded-3xl border-4 border-teal-700 bg-teal-50 p-4 text-left">
          <PillIcon shape={next.shape} color={next.color} size={80} />
          <div>
            <p className="text-2xl font-semibold text-teal-900">{t("pNextTitle")}</p>
            <p className="text-3xl font-bold text-slate-900">{next.name}</p>
            <p className="text-2xl text-slate-900">{next.dose}</p>
            <p className="text-2xl font-semibold text-slate-900">🕗 {formatTime(comingAt(next)!, lang)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-3xl text-slate-900">{today.length > 0 ? t("pNoMoreToday") : t("pNoMedsToday")}</p>
      )}

      {/* Everything for today, in time order */}
      {today.length > 0 && (
        <section className="mt-6 w-full text-left" aria-labelledby="today-title">
          <h2 id="today-title" className="text-3xl font-bold text-slate-900">
            {t("pTodayTitle")}
          </h2>
          <p className="mt-1 text-[22px] text-slate-800">{t("pTapHint")}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {today.map((d) => (
              <li key={`${d.medicationId}-${d.scheduledFor}`}>
                <button
                  type="button"
                  onClick={() => onOpenDose(d)}
                  className={`flex min-h-20 w-full items-center gap-4 rounded-3xl border-2 p-3 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 ${
                    d.status === "taken" ? "border-green-700 bg-green-50 hover:bg-green-100" : "border-slate-400 bg-white hover:bg-slate-50"
                  }`}
                >
                  <PillIcon shape={d.shape} color={d.color} size={52} />
                  <span className="flex-1">
                    <span className="block text-2xl font-bold text-slate-900">{d.name}</span>
                    <span className={`block text-2xl ${d.status === "taken" ? "font-semibold text-green-900" : "text-slate-800"}`}>
                      {statusText(d)}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-4xl text-slate-500">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* For shared devices: sign in as a different person */}
      <button
        type="button"
        onClick={onSwitchPerson}
        className="mt-8 min-h-12 text-xl font-semibold text-teal-800 underline underline-offset-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        {t("pNotYou", { name: patientName })}
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
