"use client";

// Step 3: add medicines, either by hand or from the SIMULATED hospital record.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import type { Medication, Patient } from "@/lib/types";
import {
  addMedication,
  deleteMedication,
  importHospitalDemo,
  loadMedications,
} from "@/lib/caregiver-data";
import { COLORS, SHAPES, type ColorId, type ShapeId } from "@/lib/medicine-options";
import PillIcon from "@/components/PillIcon";
import { Card, ErrorBox, Field, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import MedicineList from "./MedicineList";
import { WizardNav, type WizardData } from "./Wizard";

export default function StepMedicines({
  data,
  patient,
  onBack,
  onNext,
}: {
  data: WizardData;
  patient: Patient;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();
  const [importing, setImporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<TranslationKey | null>(null);

  const meds = data.medications;
  const alreadyImported = meds.some((m) => m.source === "HA_demo");

  async function refresh() {
    data.setMedications(await loadMedications(patient.id));
  }

  async function runImport() {
    setImporting(true);
    setProblem(null);
    try {
      await importHospitalDemo(patient.id);
    } catch (err) {
      console.error(err);
      setProblem("genericError");
    }
    await refresh().catch(() => {});
    setImporting(false);
  }

  async function remove(med: Medication) {
    setRemovingId(med.id);
    setProblem(null);
    try {
      await deleteMedication(med.id);
      await refresh();
    } catch (err) {
      console.error(err);
      setProblem("genericError");
    }
    setRemovingId(null);
  }

  function next() {
    if (meds.length === 0) {
      setProblem("s3NeedOne");
      return;
    }
    onNext();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t("s3Title")}</h1>
        <p className="mt-2 text-xl text-slate-800">{t("s3Intro")}</p>
      </div>

      {/* The two ways to add medicines, side by side on larger screens */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ManualMedicineForm
          onAdded={async (med) => {
            await addMedication(patient.id, med);
            await refresh();
          }}
        />

        <Card className="border-amber-400 bg-amber-50">
          <h2 className="text-2xl font-bold text-slate-900">🏥 {t("s3Import")}</h2>
          <p className="mt-2 text-lg text-slate-800">{t("s3ImportText")}</p>
          <p className="mt-4 rounded-xl border-2 border-amber-600 bg-white p-3 text-base font-semibold text-amber-900">
            ⚠️ {t("simulatedLabel")}
          </p>
          {alreadyImported ? (
            <p className="mt-4 text-lg font-semibold text-green-800" role="status">
              ✅ {t("s3Imported")}
            </p>
          ) : (
            <SecondaryButton className="mt-4 w-full" onClick={runImport} disabled={importing}>
              {importing ? t("s3Importing") : t("s3ImportButton")}
            </SecondaryButton>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("s3Added", { n: meds.length })}</h2>
        <div className="mt-4">
          {meds.length === 0 ? (
            <p className="text-lg text-slate-700">{t("s3NoneYet")}</p>
          ) : (
            <MedicineList medications={meds} onRemove={remove} removingId={removingId} />
          )}
        </div>
        {problem && (
          <div className="mt-4">
            <ErrorBox>{t(problem)}</ErrorBox>
          </div>
        )}
        <WizardNav onBack={onBack} onNext={next} />
      </Card>
    </div>
  );
}

type NewMed = Parameters<typeof addMedication>[1];

function ManualMedicineForm({ onAdded }: { onAdded: (med: NewMed) => Promise<void> }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [shape, setShape] = useState<ShapeId>("round");
  const [color, setColor] = useState<ColorId>("white");
  const [instructions, setInstructions] = useState("");
  const [storage, setStorage] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
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
      await onAdded({
        name: name.trim(),
        dose: dose.trim(),
        form: SHAPES.find((s) => s.id === shape)!.form,
        shape,
        color,
        instructions: instructions.trim() || null,
        storage_note: storage.trim() || null,
        source: "manual",
        times: [...filledTimes].sort(),
      });
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
      <h2 className="text-2xl font-bold text-slate-900">✍️ {t("s3Manual")}</h2>
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
                  name="pill-shape"
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
                  name="pill-color"
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

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? t("saving") : `+ ${t("s3AddMedicine")}`}
        </PrimaryButton>
      </form>
    </Card>
  );
}
