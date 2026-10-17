"use client";

// Big on-screen number pad for the 4-digit PIN. Sends automatically after 4 numbers.
// Typing numbers on a keyboard also works.

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import { askNotificationPermission } from "@/lib/reminders";
import { DEMO_MODE } from "@/lib/demo-mode";
import { Center } from "./Screens";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "delete"] as const;

export default function PinScreen({
  wrongPin,
  wrongMessage,
  busy,
  username,
  onChangeUsername,
  onSubmit,
}: {
  wrongPin: boolean;
  wrongMessage?: string;
  busy: boolean;
  username?: string; // shown when signing in without a link
  onChangeUsername?: () => void;
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
      {username && (
        <p className="mt-2 text-2xl text-slate-900">
          👤 <span className="font-mono font-bold">{username}</span>{" "}
          {onChangeUsername && (
            <button
              type="button"
              onClick={onChangeUsername}
              className="ml-2 min-h-11 rounded-full px-3 text-xl font-semibold text-teal-800 underline underline-offset-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
            >
              {t("pChange")}
            </button>
          )}
        </p>
      )}
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("pEnterPin")}</h1>
      {/* Demo mode: any 4 digits are accepted */}
      {DEMO_MODE && <p className="mt-2 text-2xl text-slate-800">{t("pDemoPin")}</p>}

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
          {wrongMessage ?? t("pWrongPin")}
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
