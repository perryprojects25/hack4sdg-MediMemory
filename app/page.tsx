"use client";

// Landing page. The caregiver is the main path (set up, or try the demo);
// patients and doctors have smaller links below. A "How it works" strip explains the idea.

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CirclePlay,
  FileText,
  Hand,
  HeartHandshake,
  KeyRound,
  ListPlus,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";

const focusRing = "focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300";

const SECONDARY_LINKS: { href: string; icon: LucideIcon; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { href: "/patient", icon: KeyRound, titleKey: "lpPatient", descKey: "lpPatientDesc" },
  { href: "/doctor", icon: Stethoscope, titleKey: "lpDoctor", descKey: "lpDoctorDesc" },
];

const STEPS: { icon: LucideIcon; key: TranslationKey }[] = [
  { icon: ListPlus, key: "lpStep1" },
  { icon: Hand, key: "lpStep2" },
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:py-6">
      {/* Hero */}
      <h1 className="text-balance text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
        {/* Keep a Chinese quote like 「我食咗藥未？」 on one line */}
        {t("landingTitle")
          .split(/(「[^」]*」)/)
          .map((part, i) =>
            part.startsWith("「") ? (
              <span key={i} className="whitespace-nowrap">
                {part}
              </span>
            ) : (
              part
            )
          )}
      </h1>
      <p className="mt-2 text-balance text-xl text-slate-800">{t("landingSubtitle")}</p>

      {/* Main path: the caregiver */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/caregiver"
          className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-full bg-teal-700 px-5 text-lg sm:px-8 sm:text-xl font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 active:bg-teal-900 ${focusRing}`}
        >
          <HeartHandshake aria-hidden="true" className="h-7 w-7 shrink-0" />
          {t("lpSetup")}
          <ArrowRight aria-hidden="true" className="hidden h-6 w-6 shrink-0 sm:block" />
        </Link>
        <Link
          href="/caregiver?demo=1"
          className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-full border-2 border-teal-700 bg-white px-5 text-lg sm:px-8 sm:text-xl font-semibold text-teal-800 transition-colors hover:bg-teal-50 active:bg-teal-100 ${focusRing}`}
        >
          <CirclePlay aria-hidden="true" className="h-7 w-7 shrink-0" />
          {t("lpDemo")}
        </Link>
      </div>

      {/* Smaller, secondary paths for patients and doctors */}
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {SECONDARY_LINKS.map(({ href, icon: Icon, titleKey, descKey }) => (
          <li key={href}>
            <Link
              href={href}
              className={`group flex h-full items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 transition-colors hover:border-teal-700 hover:bg-teal-50 ${focusRing}`}
            >
              <Icon aria-hidden="true" className="h-7 w-7 shrink-0 text-teal-700" />
              <span className="flex-1">
                <span className="block text-lg font-semibold text-slate-900 group-hover:underline group-hover:underline-offset-4">
                  {t(titleKey)}
                </span>
                <span className="block text-base text-slate-700">{t(descKey)}</span>
              </span>
              <ArrowRight
                aria-hidden="true"
                className="h-6 w-6 shrink-0 text-teal-700 transition-transform group-hover:translate-x-1"
              />
            </Link>
          </li>
        ))}
      </ul>

      {/* How it works */}
      <section aria-labelledby="how-it-works" className="mt-6">
        <h2 id="how-it-works" className="text-2xl font-bold text-slate-900">
          {t("lpHowTitle")}
        </h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, key }, i) => (
            <li key={key} className="flex items-center gap-3 rounded-2xl bg-teal-50 px-4 py-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 ring-2 ring-teal-200">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <p className="text-balance text-lg text-slate-900">
                <span className="font-bold text-teal-800">{i + 1}.</span> {t(key)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
