"use client";

// A list of medicines with their picture, dose, times and storage note.
// Pass onRemove to show a Remove button on each one.

import { useLanguage } from "@/lib/language";
import { colorOption, shapeOption, shortTime } from "@/lib/medicine-options";
import type { Medication } from "@/lib/types";
import PillIcon from "@/components/PillIcon";

export default function MedicineList({
  medications,
  onRemove,
  removingId,
}: {
  medications: Medication[];
  onRemove?: (med: Medication) => void;
  removingId?: string | null;
}) {
  const { t } = useLanguage();

  return (
    <ul className="flex flex-col gap-3">
      {medications.map((med) => (
        <li
          key={med.id}
          className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
        >
          <PillIcon
            shape={med.shape}
            color={med.color}
            size={64}
            label={`${t(colorOption(med.color).labelKey)} ${t(shapeOption(med.shape).labelKey)}`}
          />
          <div className="flex-1">
            <p className="text-xl font-bold text-slate-900">{med.name}</p>
            <p className="text-lg text-slate-800">{med.dose}</p>
            <p className="text-lg text-slate-800">
              {t("timesLabel")}:{" "}
              <span className="font-semibold">
                {med.schedules.map((s) => shortTime(s.time_of_day)).join(", ")}
              </span>
            </p>
            {med.instructions && <p className="text-base text-slate-700">{med.instructions}</p>}
            {med.storage_note && (
              <p className="text-base text-slate-700">
                🧊 {t("storageLabel")}: {med.storage_note}
              </p>
            )}
            {med.source === "HA_demo" && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                🏥 {t("s3FromHospital")}
              </span>
            )}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(med)}
              disabled={removingId === med.id}
              aria-label={t("s3RemoveLabel", { name: med.name })}
              className="min-h-12 rounded-full border-2 border-red-700 px-5 text-lg font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
            >
              {t("s3Remove")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
