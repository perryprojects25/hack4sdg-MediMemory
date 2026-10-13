"use client";

// Sign in without a link, step 1: type your username (step 2 is the PIN pad).

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { Center } from "./Screens";

export default function UsernameScreen({ onNext }: { onNext: (username: string) => void }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [tooShort, setTooShort] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) return setTooShort(true);
    onNext(clean);
  }

  return (
    <Center>
      <div className="text-6xl" aria-hidden="true">👋</div>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("pWelcome")}</h1>
      <form onSubmit={submit} className="mt-6 flex w-full flex-col gap-4">
        <label htmlFor="patient-username" className="text-2xl font-semibold text-slate-900">
          {t("pTypeUsername")}
        </label>
        <input
          id="patient-username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
            setTooShort(false);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck={false}
          className="min-h-20 w-full rounded-3xl border-4 border-slate-400 bg-white px-5 text-center font-mono text-4xl text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200"
        />
        <p className="text-xl text-slate-800">{t("pUsernameHelp")}</p>
        {tooShort && (
          <p role="alert" className="text-2xl font-semibold text-red-800">
            {t("pUsernameShort")}
          </p>
        )}
        <button
          type="submit"
          className="min-h-20 w-full rounded-3xl bg-teal-700 text-3xl font-bold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          {t("next")} →
        </button>
      </form>
    </Center>
  );
}
