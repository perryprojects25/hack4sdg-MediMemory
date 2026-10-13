"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";

// Safety note required on every page: this app is not a medical device.
export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto border-t-2 border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-4 text-center text-base text-slate-700">
        <p>{t("footerDisclaimer")}</p>
        <Link href="/about" className="mt-1 inline-block font-semibold text-teal-800 underline underline-offset-4 print:hidden">
          {t("aboutLink")}
        </Link>
      </div>
    </footer>
  );
}
