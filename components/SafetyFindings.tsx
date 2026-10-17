"use client";

// Lists of medicine safety findings. Used on the caregiver's Medicines tab and
// in the doctor summary, so both show the same thing in the same words.

import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { formatTime } from "@/lib/time";
import type { AiFinding, RuleFinding } from "@/lib/safety";

const TYPE_LABEL: Record<AiFinding["type"], TranslationKey> = {
  interaction: "safetyTypeInteraction",
  duplicate: "safetyTypeDuplicate",
  dose: "safetyTypeDose",
  older_adults: "safetyTypeOlder",
};

// The app's own (rule-based) findings.
export function RuleFindingList({ findings }: { findings: RuleFinding[] }) {
  const { t, lang } = useLanguage();
  const day = (iso: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(iso));

  function text(f: RuleFinding): string {
    switch (f.kind) {
      case "manyMedicines":
        return t("safetyManyMeds", { n: f.count });
      case "duplicate":
        return t("safetyDupRule", { a: f.a, b: f.b });
      case "extraDose":
        return t("safetyExtraDose", { name: f.medicine, n: f.count, time: formatTime(f.scheduledFor, lang), date: day(f.scheduledFor) });
      case "closeDoses":
        return t("safetyCloseDoses", { name: f.medicine, date: day(f.firstAt) });
    }
  }

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {findings.map((f, i) => (
        <li key={i} className="break-inside-avoid rounded-2xl border-2 border-amber-600 bg-amber-50 p-3 text-lg text-amber-950">
          ⚠️ {text(f)}
        </li>
      ))}
    </ul>
  );
}

// The AI's findings. The doctor sees "higher priority / for review" instead of
// the caregiver's "ask the pharmacist soon / at the next visit".
export function AiFindingList({ findings, forDoctor = false }: { findings: AiFinding[]; forDoctor?: boolean }) {
  const { t } = useLanguage();
  return (
    <ul className="mt-2 flex flex-col gap-3">
      {findings.map((f, i) => (
        <li
          key={i}
          className={`break-inside-avoid rounded-2xl border-2 p-4 text-lg ${
            f.level === "ask_soon" ? "border-amber-600 bg-amber-50 text-amber-950" : "border-slate-300 bg-white text-slate-900"
          }`}
        >
          <p className="text-base font-semibold">
            {t(TYPE_LABEL[f.type])} ·{" "}
            {f.level === "ask_soon"
              ? t(forDoctor ? "safetyLevelHigh" : "safetyLevelSoon")
              : t(forDoctor ? "safetyLevelReview" : "safetyLevelVisit")}
          </p>
          <p className="mt-1 font-bold">{f.medicines.join(" + ")}</p>
          <p className="mt-1">{f.what}</p>
          {f.ask && (
            <p className="mt-2">
              <span className="font-semibold">{t("safetyAsk")}</span> {f.ask}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
