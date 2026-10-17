"use client";

import Link from "next/link";
import { Pill } from "lucide-react";
import { useLanguage } from "@/lib/language";

// Simple top bar: app name on the left, language switch on the right.
export default function TopBar() {
  const { t, lang, toggleLang } = useLanguage();

  return (
    <header className="border-b-2 border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-teal-800">
          <Pill aria-hidden="true" className="h-7 w-7 text-teal-700" />
          {t("appName")}
        </Link>

        {/* Language switch: EN | 中文, the teal pill slides to the language in use */}
        <button
          type="button"
          role="switch"
          aria-checked={lang === "zh"}
          aria-label={t("langToggleLabel")}
          onClick={toggleLang}
          className="relative inline-flex min-h-11 items-center rounded-full border-2 border-teal-700 bg-white p-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          <span
            aria-hidden="true"
            className={`absolute bottom-1 left-1 top-1 w-14 rounded-full bg-teal-700 transition-transform duration-200 motion-reduce:transition-none ${
              lang === "zh" ? "translate-x-full" : ""
            }`}
          />
          <span
            aria-hidden="true"
            className={`relative w-14 text-center text-lg font-semibold transition-colors ${lang === "en" ? "text-white" : "text-teal-800"}`}
          >
            EN
          </span>
          <span
            aria-hidden="true"
            className={`relative w-14 text-center text-lg font-semibold transition-colors ${lang === "zh" ? "text-white" : "text-teal-800"}`}
          >
            中文
          </span>
        </button>
      </div>
    </header>
  );
}
