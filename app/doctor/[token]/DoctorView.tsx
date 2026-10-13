"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";
import type { SummaryContent } from "@/lib/summary";
import SummaryView from "@/components/SummaryView";

export default function DoctorView({ content }: { content: SummaryContent | null }) {
  const { t } = useLanguage();

  if (!content) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center">
        <div className="text-6xl" aria-hidden="true">🔗</div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{t("docInvalidTitle")}</h1>
        <p className="mt-3 text-xl text-slate-800">{t("docInvalidText")}</p>
        <Link href="/" className="mt-6 inline-block text-lg font-semibold text-teal-800 underline">
          {t("backHome")}
        </Link>
      </main>
    );
  }

  function print() {
    // Open the raw log so it is included on paper / in the PDF.
    document.querySelectorAll<HTMLDetailsElement>("details.raw-log").forEach((d) => (d.open = true));
    window.print();
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 bg-white px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex justify-end print:hidden">
        <button
          type="button"
          onClick={print}
          className="min-h-12 rounded-full bg-teal-700 px-6 text-lg font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          🖨 {t("docPrint")}
        </button>
      </div>
      <SummaryView content={content} />
    </main>
  );
}
