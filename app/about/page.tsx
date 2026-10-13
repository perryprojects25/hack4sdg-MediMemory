"use client";

// "How this works" plus the privacy and ethics note (section 6 of the plan).

import Link from "next/link";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";

const STEPS: { icon: string; key: TranslationKey }[] = [
  { icon: "🤝", key: "aboutStep1" },
  { icon: "💊", key: "aboutStep2" },
  { icon: "🩺", key: "aboutStep3" },
];
const ETHICS: TranslationKey[] = [
  "aboutEthics1",
  "aboutEthics2",
  "aboutEthics3",
  "aboutEthics4",
  "aboutEthics5",
  "aboutEthics6",
  "aboutEthics7",
];
const DEMO: TranslationKey[] = ["aboutDemo1", "aboutDemo2", "aboutDemo3"];

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-slate-900">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("aboutTitle")}</h1>
      <p className="mt-4 text-xl leading-relaxed text-slate-800">{t("aboutIntro")}</p>

      <h2 className="mt-10 text-2xl font-bold">{t("aboutStepsTitle")}</h2>
      <ol className="mt-4 flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
            <span className="text-4xl" aria-hidden="true">
              {step.icon}
            </span>
            <p className="text-lg">
              <strong>{i + 1}.</strong> {t(step.key)}
            </p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-2xl font-bold">🛡️ {t("aboutEthicsTitle")}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {ETHICS.map((key) => (
          <li key={key} className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-4 text-lg leading-relaxed">
            {t(key)}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-2xl font-bold">🧪 {t("aboutDemoTitle")}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {DEMO.map((key) => (
          <li key={key} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-lg leading-relaxed">
            {t(key)}
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-10 inline-flex min-h-14 items-center rounded-full bg-teal-700 px-8 text-xl font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        ← {t("backHome")}
      </Link>
    </main>
  );
}
