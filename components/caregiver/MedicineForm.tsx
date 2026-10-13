"use client";

// Form to add or edit a medicine: name, dose, visual shape and colour picker,
// instructions, storage note and daily times.

import { useId, useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import type { Medication } from "@/lib/types";
import type { NewMedication } from "@/lib/caregiver-data";
import { COLORS, SHAPES, shortTime, type ColorId, type ShapeId } from "@/lib/medicine-options";
import PillIcon from "@/components/PillIcon";
import { Card, ErrorBox, Field, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";


export default function MedicineForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Medication; // set when editing an existing medicine
  onSave: (med: Omit<NewMedication, "source">) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useLanguage();
  const formId = useId(); // keeps radio groups separate when two forms are on screen
  const [name, setName] = useState(initial?.name ?? "");
  const [dose, setDose] = useState(initial?.dose ?? "");
  const [shape, setShape] = useState<ShapeId>((initial?.shape as ShapeId) ?? "round");
  const [color, setColor] = useState<ColorId>((initial?.color as ColorId) ?? "white");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [storage, setStorage] = useState(initial?.storage_note ?? "");
  const [times, setTimes] = useState<string[]>(
    initial ? initial.schedules.map((s) => shortTime(s.time_of_day)) : ["08:00"]
  );
  const [errors, setErrors] = useState<{ name?: TranslationKey; dose?: TranslationKey; times?: TranslationKey }>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const filledTimes = times.filter(Boolean);

    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "errMedNameRequired";
    if (!dose.trim()) newErrors.dose = "errDoseRequired";
    if (filledTimes.length === 0) newErrors.times = "errTimesRequired";
    else if (new Set(filledTimes).size !== filledTimes.length) newErrors.times = "errTimesDuplicate";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    setFailed(false);
    try {
      await onSave({
        name: name.trim(),
        dose: dose.trim(),
        form: SHAPES.find((s) => s.id === shape)!.form,
        shape,
        color,
        instructions: instructions.trim() || null,
        storage_note: storage.trim() || null,
        times: [...filledTimes].sort(),
      });
      if (initial) return; // editing: the screen that opened this form closes it
      // Clear the form for the next medicine.
      setName("");
      setDose("");
      setInstructions("");
      setStorage("");
      setTimes(["08:00"]);
    } catch (err) {
      console.error(err);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-900">
        {initial ? `✏️ ${t("medEditTitle")}` : `✍️ ${t("s3Manual")}`}
      </h2>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
        <Field label={t("s3MedName")} hint={t("s3MedNameHint")} error={errors.name && t(errors.name)}>
          {(props) => (
            <input {...props} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          )}
        </Field>

        <Field label={t("s3Dose")} hint={t("s3DoseHint")} error={errors.dose && t(errors.dose)}>
          {(props) => (
            <input {...props} className={inputClass} value={dose} onChange={(e) => setDose(e.target.value)} maxLength={60} />
          )}
        </Field>

        {/* Visual shape picker: each option shows the pill in the chosen colour */}
        <fieldset>
          <legend className="text-xl font-semibold text-slate-900">{t("s3Shape")}</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {SHAPES.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-slate-300 bg-white p-3 text-center text-lg text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-300"
              >
                <input
                  type="radio"
                  name={`${formId}-shape`}
                  className="sr-only"
                  checked={shape === option.id}
                  onChange={() => setShape(option.id)}
                />
                <PillIcon shape={option.id} color={color} size={56} />
                {t(option.labelKey)}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Colour swatches */}
        <fieldset>
          <legend className="text-xl font-semibold text-slate-900">{t("s3Color")}</legend>
          <div className="mt-2 grid grid-cols-4 gap-3">
            {COLORS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-slate-300 bg-white p-2 text-base text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-300"
              >
                <input
                  type="radio"
                  name={`${formId}-color`}
                  className="sr-only"
                  checked={color === option.id}
                  onChange={() => setColor(option.id)}
                />
                <span
                  className="h-9 w-9 rounded-full border-2 border-slate-800"
                  style={{ backgroundColor: option.hex }}
                  aria-hidden="true"
                />
                {t(option.labelKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t("s3Instructions")} hint={t("s3InstructionsHint")}>
          {(props) => (
            <input {...props} className={inputClass} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={150} />
          )}
        </Field>

        <Field label={t("s3Storage")} hint={t("s3StorageHint")}>
          {(props) => (
            <input {...props} className={inputClass} value={storage} onChange={(e) => setStorage(e.target.value)} maxLength={150} />
          )}
        </Field>

        {/* Daily times */}
        <fieldset>
          <legend className="text-xl font-semibold text-slate-900">{t("s3Times")}</legend>
          <div className="mt-2 flex flex-col gap-3">
            {times.map((time, i) => (
              <div key={i} className="flex gap-3">
                <input
                  type="time"
                  aria-label={`${t("s3Times")} ${i + 1}`}
                  className={`${inputClass} max-w-48`}
                  value={time}
                  onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTimes(times.filter((_, j) => j !== i))}
                    aria-label={t("s3RemoveTime")}
                    className="min-h-14 min-w-14 rounded-xl border-2 border-slate-400 text-2xl text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {errors.times && <p className="text-lg font-medium text-red-800">{t(errors.times)}</p>}
            {times.length < 6 && (
              <button
                type="button"
                onClick={() => setTimes([...times, ""])}
                className="self-start text-lg font-semibold text-teal-800 underline underline-offset-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
              >
                {t("s3AddTime")}
              </button>
            )}
          </div>
        </fieldset>

        {failed && <ErrorBox>{t("genericError")}</ErrorBox>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton type="submit" disabled={saving} className="flex-1">
            {saving ? t("saving") : initial ? t("medSaveChanges") : `+ ${t("s3AddMedicine")}`}
          </PrimaryButton>
          {onCancel && (
            <SecondaryButton onClick={onCancel} disabled={saving}>
              {t("cancel")}
            </SecondaryButton>
          )}
        </div>
      </form>
    </Card>
  );
}
