// Adherence numbers, computed in code from the dose list (never by AI).

import { LATE_AFTER_MINUTES } from "./dose-rules";
import type { DoseInstance } from "./doses";

const MINUTE = 60 * 1000;

// A dose is "resolved" once we know the outcome: taken, missed or skipped.
// Doses still upcoming / due / late (still in their window) don't count yet.
export function isResolved(dose: DoseInstance): boolean {
  return dose.status === "taken" || dose.status === "missed" || dose.status === "skipped";
}

export function takenLate(dose: DoseInstance): boolean {
  if (!dose.takenAt) return false;
  return new Date(dose.takenAt).getTime() - new Date(dose.scheduledFor).getTime() > LATE_AFTER_MINUTES * MINUTE;
}

// Percentage of resolved doses that were taken, or null if there were none.
export function adherencePct(doses: DoseInstance[]): number | null {
  const resolved = doses.filter(isResolved);
  if (resolved.length === 0) return null;
  const taken = resolved.filter((d) => d.status === "taken").length;
  return Math.round((taken / resolved.length) * 100);
}

export type MedicineAdherence = {
  medicationId: string;
  name: string;
  source: string | undefined;
  pct: number | null;
  scheduled: number; // resolved doses
  taken: number;
  missed: number;
  takenLate: number;
  doubleDoses: number;
};

export function adherenceByMedicine(doses: DoseInstance[]): MedicineAdherence[] {
  const byMed = new Map<string, DoseInstance[]>();
  for (const dose of doses) byMed.set(dose.med.id, [...(byMed.get(dose.med.id) ?? []), dose]);

  return [...byMed.values()].map((medDoses) => {
    const resolved = medDoses.filter(isResolved);
    return {
      medicationId: medDoses[0].med.id,
      name: medDoses[0].med.name,
      source: medDoses[0].med.source,
      pct: adherencePct(medDoses),
      scheduled: resolved.length,
      taken: resolved.filter((d) => d.status === "taken").length,
      missed: resolved.filter((d) => d.status === "missed").length,
      takenLate: resolved.filter(takenLate).length,
      doubleDoses: medDoses.filter((d) => d.takenCount > 1).length,
    };
  });
}

// Adherence per day, for the calendar heatmap.
export function adherenceByDay(doses: DoseInstance[], dates: string[]) {
  return dates.map((date) => {
    const dayDoses = doses.filter((d) => d.date === date);
    const resolved = dayDoses.filter(isResolved);
    return {
      date,
      pct: adherencePct(dayDoses),
      taken: resolved.filter((d) => d.status === "taken").length,
      total: resolved.length,
    };
  });
}
