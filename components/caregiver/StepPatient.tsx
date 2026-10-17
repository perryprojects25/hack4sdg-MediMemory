"use client";

// Step 2: add the person you care for.
// A new person can only be saved after the caregiver confirms that the person, or
// their legal guardian, agreed to their medical information being entered.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { savePatient } from "@/lib/caregiver-data";
import { Card, ErrorBox, Field, inputClass } from "@/components/ui";
import { WizardNav, type WizardData } from "./Wizard";

export default function StepPatient({
  data,
  onBack,
  onNext,
}: {
  data: WizardData;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();
  const existing = data.patient;

  const [name, setName] = useState(existing?.name ?? "");
  const [age, setAge] = useState(existing?.age?.toString() ?? "");
  const [language, setLanguage] = useState<"en" | "zh">(existing?.preferred_language ?? "zh");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  // Editing someone already added: consent was confirmed when they were added.
  const [consent, setConsent] = useState(Boolean(existing));
  const [errors, setErrors] = useState<{ name?: TranslationKey; age?: TranslationKey; consent?: TranslationKey }>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveAndContinue() {
    const cleanName = name.trim();
    const ageNumber = Number(age);

    const newErrors: typeof errors = {};
    if (!cleanName) newErrors.name = "errNameRequired";
    if (!Number.isInteger(ageNumber) || ageNumber < 1 || ageNumber > 130) newErrors.age = "errAgeInvalid";
    if (!consent) newErrors.consent = "errConsent";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    setFailed(false);
    try {
      const patient = await savePatient(data.caregiver.id, existing?.id ?? null, {
        name: cleanName,
        age: ageNumber,
        preferred_language: language,
        notes: notes.trim() || null,
      });
      data.setPatient(patient);
      onNext();
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h1 className="text-3xl font-bold text-slate-900">{t("s2Title")}</h1>
      <p className="mt-2 text-xl text-slate-800">{t("s2Intro")}</p>

      <div className="mt-6 flex flex-col gap-6">
        {failed && <ErrorBox>{t("genericError")}</ErrorBox>}

        <Field label={t("s2Name")} hint={t("s2NameHint")} error={errors.name && t(errors.name)}>
          {(props) => (
            <input
              {...props}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          )}
        </Field>

        <Field label={t("s2Age")} error={errors.age && t(errors.age)}>
          {(props) => (
            <input
              {...props}
              className={`${inputClass} max-w-40`}
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={3}
            />
          )}
        </Field>

        <fieldset>
          <legend className="text-xl font-semibold text-slate-900">{t("s2Lang")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["zh", "en"] as const).map((option) => (
              <label
                key={option}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-400 bg-white px-4 text-xl text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-300"
              >
                <input
                  type="radio"
                  name="patient-language"
                  value={option}
                  checked={language === option}
                  onChange={() => setLanguage(option)}
                  className="h-6 w-6 accent-teal-700"
                />
                {option === "zh" ? t("langZh") : t("langEn")}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t("s2Notes")} hint={t("s2NotesHint")}>
          {(props) => (
            <textarea
              {...props}
              className={`${inputClass} min-h-28 py-3`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
            />
          )}
        </Field>

        {/* Consent of the person, or their legal guardian (required for a new person) */}
        {!existing && (
          <fieldset
            className={`rounded-2xl border-2 p-4 ${errors.consent ? "border-red-700 bg-red-50" : "border-sky-700 bg-sky-50"}`}
          >
            <legend className="px-1 text-xl font-semibold text-slate-900">{t("s2ConsentTitle")}</legend>
            <p className="text-lg text-slate-800">{t("s2ConsentHint")}</p>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-lg text-slate-900">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setErrors({ ...errors, consent: undefined });
                }}
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? "consent-error" : undefined}
                className="mt-1 h-6 w-6 shrink-0 accent-teal-700"
              />
              {name.trim() ? t("s2Consent", { name: name.trim() }) : t("s2ConsentNoName")}
            </label>
            {errors.consent && (
              <p id="consent-error" role="alert" className="mt-2 text-lg font-semibold text-red-800">
                {t(errors.consent)}
              </p>
            )}
          </fieldset>
        )}
      </div>

      <WizardNav onBack={onBack} onNext={saveAndContinue} busy={saving} />
    </Card>
  );
}
