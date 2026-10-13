"use client";

// Error boundary: if a page crashes, show a calm message instead of a technical error.

import { useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 text-center">
      <div className="text-6xl" aria-hidden="true">
        🙏
      </div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">{t("errorTitle")}</h1>
      <p className="mt-3 text-xl text-slate-800">{t("errorText")}</p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="min-h-14 rounded-full bg-teal-700 px-8 text-xl font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          {t("tryAgain")}
        </button>
        <Link href="/" className="text-lg font-semibold text-teal-800 underline">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
