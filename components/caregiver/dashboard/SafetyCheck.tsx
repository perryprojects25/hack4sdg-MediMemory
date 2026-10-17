"use client";

// "Medicine safety check" card on the Medicines tab.
// Shows the app's own checks and the AI check. Everything is phrased as something
// to ask the pharmacist or doctor about. Nothing here is advice.

import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { formatTime } from "@/lib/time";
import type { AiFinding, RuleFinding } from "@/lib/safety";
import { Card, SecondaryButton } from "@/components/ui";
import AiConsentCard from "./AiConsent";
import type { SafetyCheck as Safety } from "./useSafetyCheck";

const TYPE_LABEL: Record<AiFinding["type"], TranslationKey> = {
  interaction: "safetyTypeInteraction",
  duplicate: "safetyTypeDuplicate",
  dose: "safetyTypeDose",
  older_adults: "safetyTypeOlder",
};

export default function SafetyCheck({ safety }: { safety: Safety }) {
  const { t, lang } = useLanguage();
  const { rules, ai, status } = safety;

  const day = (iso: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(iso));

  function ruleText(f: RuleFinding): string {
    if (f.kind === "manyMedicines") return t("safetyManyMeds", { n: f.count });
    if (f.kind === "extraDose") {
      return t("safetyExtraDose", { name: f.medicine, n: f.count, time: formatTime(f.scheduledFor, lang), date: day(f.scheduledFor) });
    }
    return t("safetyCloseDoses", { name: f.medicine, date: day(f.firstAt) });
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <ShieldCheck aria-hidden="true" className="h-7 w-7 text-teal-700" />
        {t("safetyTitle")}
      </h2>
      <p className="mt-1 text-lg text-slate-700">{t("safetyIntro")}</p>

      {/* The app's own checks (no AI) */}
      {rules.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xl font-semibold text-slate-900">{t("safetyRulesTitle")}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {rules.map((f, i) => (
              <li key={i} className="rounded-2xl border-2 border-amber-600 bg-amber-50 p-3 text-lg text-amber-950">
                ⚠️ {ruleText(f)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The AI check */}
      <div className="mt-4">
        {status === "noConsent" ? (
          <AiConsentCard onAgree={safety.consent} />
        ) : (
          <>
            <h3 className="text-xl font-semibold text-slate-900">{t("safetyAiTitle")}</h3>
            {status === "checking" && (
              <p role="status" className="mt-2 text-lg text-slate-800">
                {t("safetyChecking")}
              </p>
            )}
            {status === "unavailable" && <p className="mt-2 text-lg text-slate-800">{t("safetyUnavailable")}</p>}
            {status === "failed" && <p className="mt-2 text-lg text-slate-800">{t("genericError")}</p>}
            {status === "done" && ai && (
              <>
                {ai.findings.length === 0 ? (
                  <p className="mt-2 text-lg text-slate-800">{t("safetyNone")}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {ai.findings.map((f, i) => (
                      <li
                        key={i}
                        className={`rounded-2xl border-2 p-4 text-lg ${
                          f.level === "ask_soon" ? "border-amber-600 bg-amber-50 text-amber-950" : "border-slate-300 bg-white text-slate-900"
                        }`}
                      >
                        <p className="text-base font-semibold">
                          {t(TYPE_LABEL[f.type])} · {f.level === "ask_soon" ? t("safetyLevelSoon") : t("safetyLevelVisit")}
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
                )}
                <p className="mt-2 text-base text-slate-700">
                  {t("safetyCheckedAt", { time: `${day(ai.checkedAt)} ${formatTime(ai.checkedAt, lang)}` })}
                </p>
              </>
            )}
            {status !== "checking" && (
              <SecondaryButton className="mt-3 min-h-12 text-lg" onClick={safety.run}>
                {ai ? t("safetyRerun") : t("safetyRun")}
              </SecondaryButton>
            )}
          </>
        )}
      </div>

      <p className="mt-4 rounded-xl bg-slate-100 p-3 text-base text-slate-800">{t("safetyDisclaimer")}</p>
    </Card>
  );
}
