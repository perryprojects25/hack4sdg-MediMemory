"use client";

// One-time consent notice before any AI feature (doctor summary, medicine safety check):
// medicine data goes to an external AI provider. Agreeing once covers both.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { Card, PrimaryButton } from "@/components/ui";

// Bumped when the AI provider changed, so caregivers see the updated notice again.
export const CONSENT_KEY = "medimemory-ai-consent-v2";
// The AI service named in the consent notice (lib/ai.ts).
const AI_PROVIDER = "Google Gemini";

export function hasAiConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

export function saveAiConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "yes");
  } catch {}
}

export default function AiConsentCard({ onAgree }: { onAgree: () => void }) {
  const { t } = useLanguage();
  const [ticked, setTicked] = useState(false);
  return (
    <Card className="border-sky-700 bg-sky-50">
      <h2 className="text-2xl font-bold text-slate-900">🔒 {t("consentTitle")}</h2>
      <p className="mt-3 text-lg text-slate-900">{t("consentText1", { provider: AI_PROVIDER })}</p>
      <p className="mt-2 text-lg text-slate-900">{t("consentText2")}</p>
      <p className="mt-2 text-lg text-slate-900">{t("consentText3")}</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-lg text-slate-900">
        <input
          type="checkbox"
          checked={ticked}
          onChange={(e) => setTicked(e.target.checked)}
          className="mt-1 h-6 w-6 accent-teal-700"
        />
        {t("consentCheck")}
      </label>
      <PrimaryButton
        className="mt-4"
        disabled={!ticked}
        onClick={() => {
          saveAiConsent();
          onAgree();
        }}
      >
        {t("consentContinue")}
      </PrimaryButton>
    </Card>
  );
}
