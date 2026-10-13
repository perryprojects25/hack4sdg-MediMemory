"use client";

// Big on-screen number pad for the 4-digit PIN. Sends automatically after 4 numbers.
// Typing numbers on a keyboard also works.

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import { askNotificationPermission } from "@/lib/reminders";
import { Center } from "./Screens";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"] as const;

export default function PinScreen({
  wrongPin,
  busy,
  onSubmit,
}: {
  wrongPin: boolean;
  busy: boolean;
  onSubmit: (pin: string) => void;
}) {
  const { t } = useLanguage();
  const [pin, setPin] = useState("");

  function press(key: (typeof KEYS)[number]) {
    if (busy) return;
    if (key === "clear") return setPin("");
    if (key === "delete") return setPin(pin.slice(0, -1));
    const next = (pin + key).slice(0, 4);
    if (next.length === 4) {
      askNotificationPermission(); // asked during a tap, so the browser shows the prompt
      setPin("");
      onSubmit(next);
    } else {
      setPin(next);
    }
  }

  // Allow typing with a physical keyboard too.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) press(event.key as (typeof KEYS)[number]);
      if (event.key === "Backspace") press("delete");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Center>
      <div className="text-6xl" aria-hidden="true">🔒</div>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("pEnterPin")}</h1>

      {/* Four boxes that fill in as numbers are pressed */}
      <div className="mt-6 flex gap-3" aria-live="polite" aria-label={`${pin.length} / 4`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex h-16 w-14 items-center justify-center rounded-2xl border-4 text-4xl ${
              i < pin.length ? "border-teal-700 bg-teal-50" : "border-slate-400 bg-white"
            }`}
          >
            {i < pin.length ? "●" : ""}
          </div>
        ))}
      </div>

      {wrongPin && (
        <p role="alert" className="mt-4 text-2xl font-semibold text-red-800">
          {t("pWrongPin")}
        </p>
      )}

      <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={busy}
            aria-label={key === "clear" ? t("pClear") : key === "delete" ? t("pDeleteDigit") : key}
            className={`min-h-20 rounded-3xl border-2 font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 disabled:opacity-50 ${
              key === "clear" || key === "delete"
                ? "border-slate-400 bg-slate-100 text-2xl text-slate-900"
                : "border-slate-400 bg-white text-4xl text-slate-900 active:bg-teal-100"
            }`}
          >
            {key === "clear" ? t("pClear") : key === "delete" ? "⌫" : key}
          </button>
        ))}
      </div>
    </Center>
  );
}
