"use client";

import Link from "next/link";
import { Pill } from "lucide-react";
import { useLanguage } from "@/lib/language";

// Simple top bar: app name on the left, language switch on the right.
export default function TopBar() {
  const { t, toggleLang } = useLanguage();

  return (
    <header className="border-b-2 border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-teal-800">
          <Pill aria-hidden="true" className="h-7 w-7 text-teal-700" />
          {t("appName")}
        </Link>
        <button
          type="button"
          onClick={toggleLang}
          aria-label={t("switchLanguageLabel")}
          className="min-h-12 rounded-full border-2 border-teal-700 px-5 text-lg font-semibold text-teal-800 hover:bg-teal-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          {t("switchLanguage")}
        </button>
      </div>
    </header>
  );
}
