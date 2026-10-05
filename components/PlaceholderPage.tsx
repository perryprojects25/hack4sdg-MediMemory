"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";

// Temporary page layout used until each real screen is built.
export default function PlaceholderPage({
  icon,
  titleKey,
  textKey,
  detail,
}: {
  icon: string;
  titleKey: TranslationKey;
  textKey: TranslationKey;
  // Optional extra line, e.g. the doctor link code.
  detail?: { labelKey: TranslationKey; value: string };
}) {
  const { t } = useLanguage();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-8 text-center">
        <div className="text-6xl" aria-hidden="true">
          {icon}
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{t(titleKey)}</h1>
        <p className="mt-4 text-xl text-slate-800">{t(textKey)}</p>
        <p className="mt-2 text-lg font-semibold text-teal-800">{t("comingSoon")}</p>
        {detail && (
          <p className="mt-4 text-lg text-slate-800">
            {t(detail.labelKey)}: <code className="font-mono font-bold">{detail.value}</code>
          </p>
        )}
        <Link
          href="/"
          className="mt-8 inline-flex min-h-14 items-center rounded-full bg-teal-700 px-8 text-xl font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          ← {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
