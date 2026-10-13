"use client";

// Landing page. Three roles in priority order:
//   1. the patient (big filled button), 2. the family caregiver (outlined button),
//   3. the doctor (plain text link). The demo is a small link below.
// Only two button styles (filled, outlined) plus plain text links.

import { useEffect } from "react";
import Link from "next/link";
import { CircleCheckBig, FileText, HeartHandshake, ListPlus, Pill, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";

const focusRing = "focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 focus-visible:ring-offset-2";

const STEPS: { icon: LucideIcon; key: TranslationKey }[] = [
  { icon: ListPlus, key: "lpStep1" },
  { icon: CircleCheckBig, key: "lpStep2" },
  { icon: FileText, key: "lpStep3" },
];

export default function Home() {
  const { t } = useLanguage();

  // If a caregiver's sign-in email link lands here instead of /caregiver
  // (Supabase falls back to the home page), pass it on to the caregiver area.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") || hash.includes("error_code")) {
      window.location.replace(`/caregiver${hash}`);
    }
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-4 pb-2 pt-4">
      <h1 className="text-balance text-4xl font-bold leading-tight text-slate-900">{t("heroTitle")}</h1>
      <p className="text-balance text-xl text-slate-800">{t("heroSub")}</p>

      {/* 1. Patient: the first and most obvious thing on the page */}
      <Link
        href="/patient"
        className={`flex min-h-20 items-center gap-4 rounded-3xl bg-teal-700 px-6 py-2.5 text-white transition-colors hover:bg-teal-800 active:bg-teal-900 ${focusRing}`}
      >
        <Pill aria-hidden="true" className="h-10 w-10 shrink-0" strokeWidth={2.25} />
        <span>
          <span className="block text-2xl font-bold leading-tight">{t("lpPatientTitle")}</span>
          <span className="block text-lg text-teal-50">{t("lpPatientSub")}</span>
        </span>
      </Link>

      {/* 2. Family caregiver: clearly secondary */}
      <Link
        href="/caregiver"
        className={`flex min-h-[72px] items-center gap-4 rounded-3xl border-2 border-teal-700 bg-white px-6 py-2 text-teal-800 transition-colors hover:bg-teal-50 active:bg-teal-100 ${focusRing}`}
      >
        <HeartHandshake aria-hidden="true" className="h-8 w-8 shrink-0" strokeWidth={2.25} />
        <span>
          <span className="block text-[22px] font-bold leading-tight">{t("lpCaregiverTitle")}</span>
          <span className="block text-base text-slate-700">{t("lpCaregiverSub")}</span>
        </span>
      </Link>

      {/* 3. Doctor: a plain text link */}
      <Link
        href="/doctor"
        className={`self-start rounded text-base font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950 ${focusRing}`}
      >
        {t("lpDoctorLink")}
      </Link>

      {/* Demo: small and out of the way */}
      <Link
        href="/caregiver?demo=1"
        className={`self-start rounded text-base text-slate-700 underline underline-offset-4 hover:text-slate-900 ${focusRing}`}
      >
        {t("lpDemoLink")}
      </Link>

      {/* How it works (information only, not clickable) */}
      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-center text-2xl font-bold text-slate-900">
          {t("lpHowTitle")}
        </h2>
        <ol className="mt-2 grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, key }, i) => (
            <li key={key} className="flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                <span
                  aria-hidden="true"
                  className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-800 text-xs font-bold text-white"
                >
                  {i + 1}
                </span>
              </span>
              <p className="text-balance text-lg leading-snug text-slate-900 sm:text-base">{t(key)}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
