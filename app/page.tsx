"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";

// The three roles shown on the landing page.
const roles: {
  href: string;
  icon: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  color: string;
}[] = [
  {
    href: "/patient",
    icon: "💊",
    titleKey: "rolePatientTitle",
    descKey: "rolePatientDesc",
    color: "border-green-700 hover:bg-green-50",
  },
  {
    href: "/caregiver",
    icon: "🤝",
    titleKey: "roleCaregiverTitle",
    descKey: "roleCaregiverDesc",
    color: "border-teal-700 hover:bg-teal-50",
  },
  {
    href: "/doctor",
    icon: "🩺",
    titleKey: "roleDoctorTitle",
    descKey: "roleDoctorDesc",
    color: "border-blue-700 hover:bg-blue-50",
  },
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="text-center text-3xl font-bold text-slate-900 sm:text-4xl">
        {t("landingTitle")}
      </h1>
      <p className="mt-4 text-center text-xl text-slate-800">{t("landingSubtitle")}</p>

      <h2 className="mt-10 text-2xl font-semibold text-slate-900">{t("chooseRole")}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {roles.map((role) => (
          <li key={role.href}>
            <Link
              href={role.href}
              className={`flex h-full flex-col items-center rounded-3xl border-4 bg-white p-6 text-center focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 ${role.color}`}
            >
              <span className="text-6xl" aria-hidden="true">
                {role.icon}
              </span>
              <span className="mt-3 text-2xl font-bold text-slate-900">{t(role.titleKey)}</span>
              <span className="mt-2 text-lg text-slate-800">{t(role.descKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
