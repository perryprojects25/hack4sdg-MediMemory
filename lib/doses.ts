// Works out every scheduled dose and its status from medicines + intake logs.
// Shared by the patient screen, caregiver dashboard, missed-dose checker and AI summary,
// so they all agree on what "taken", "late" and "missed" mean.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LATE_AFTER_MINUTES,
  MISSED_AFTER_MINUTES,
  SNOOZE_MINUTES,
  TIME_ZONE,
  UTC_OFFSET,
} from "./dose-rules";

const MINUTE = 60 * 1000;

export type MedForDoses = {
  id: string;
  name: string;
  dose: string;
  shape: string | null;
  color: string | null;
  instructions: string | null;
  storage_note?: string | null;
  source?: string;
  active: boolean;
  created_at: string;
  schedules: { time_of_day: string; days_of_week: number[] }[];
};

export type LogForDoses = {
  id?: string;
  medication_id: string;
  scheduled_for: string;
  status: string; // taken | late | missed | snoozed | skipped
  logged_at: string;
  logged_by: string; // patient | caregiver | auto
};

export type DoseStatus =
  | "taken"
  | "missed" // no answer within the missed window (or marked missed)
  | "skipped"
  | "late" // no answer yet, past the late window but still within the missed window
  | "due" // time to take it now
  | "snoozed" // "Remind me later" pressed, not late yet
  | "upcoming"; // not time yet

export type DoseInstance = {
  med: MedForDoses;
  date: string; // Hong Kong date, "2026-10-13"
  scheduledFor: string; // ISO time
  status: DoseStatus;
  takenAt: string | null; // first "taken" log
  takenBy: string | null;
  takenCount: number; // more than 1 = possible double dose
  snoozeCount: number;
  snoozedUntil: string | null;
  hasLateLog: boolean;
  hasMissedLog: boolean;
};

// Hong Kong date of a moment, e.g. "2026-10-13".
export function hongKongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

// "2026-10-13" + 1 -> "2026-10-14"
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00${UTC_OFFSET}`);
  return hongKongDate(new Date(d.getTime() + days * 24 * 60 * MINUTE));
}

// 0 = Sunday ... 6 = Saturday, for a Hong Kong date.
export function weekdayOf(date: string): number {
  // Noon in Hong Kong is still the same date in UTC.
  return new Date(`${date}T12:00:00${UTC_OFFSET}`).getUTCDay();
}

// The Hong Kong dates from `days - 1` days ago up to today.
export function lastDays(days: number, now = new Date()): string[] {
  const today = hongKongDate(now);
  return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
}

// Start of a Hong Kong date as an ISO time (for database queries).
export function dayStartISO(date: string): string {
  return new Date(`${date}T00:00:00${UTC_OFFSET}`).toISOString();
}

export function buildDoses(
  meds: MedForDoses[],
  logs: LogForDoses[],
  dates: string[],
  now = new Date()
): DoseInstance[] {
  // Group logs by medication + dose time for quick lookup.
  const byDose = new Map<string, LogForDoses[]>();
  for (const log of logs) {
    const key = `${log.medication_id}|${new Date(log.scheduled_for).getTime()}`;
    byDose.set(key, [...(byDose.get(key) ?? []), log]);
  }

  const doses: DoseInstance[] = [];
  for (const med of meds) {
    if (!med.active) continue; // paused medicines have no doses
    const addedOn = hongKongDate(new Date(med.created_at));
    for (const date of dates) {
      if (date < addedOn) continue; // no doses before the medicine was added
      const weekday = weekdayOf(date);
      for (const schedule of med.schedules) {
        if (!schedule.days_of_week.includes(weekday)) continue;
        const scheduledFor = new Date(`${date}T${schedule.time_of_day}${UTC_OFFSET}`);
        const doseLogs = byDose.get(`${med.id}|${scheduledFor.getTime()}`) ?? [];
        doses.push({ med, date, scheduledFor: scheduledFor.toISOString(), ...doseState(scheduledFor, doseLogs, now) });
      }
    }
  }
  return doses.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

function doseState(scheduledFor: Date, logs: LogForDoses[], now: Date) {
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const taken = sorted.filter((log) => log.status === "taken");
  const snoozes = sorted.filter((log) => log.status === "snoozed");
  const lastSnooze = snoozes.at(-1);
  const snoozedUntil = lastSnooze
    ? new Date(new Date(lastSnooze.logged_at).getTime() + SNOOZE_MINUTES * MINUTE)
    : null;
  const minutesPast = (now.getTime() - scheduledFor.getTime()) / MINUTE;

  let status: DoseStatus;
  if (taken.length > 0) status = "taken";
  else if (sorted.some((log) => log.status === "skipped")) status = "skipped";
  else if (sorted.some((log) => log.status === "missed")) status = "missed";
  else if (minutesPast < 0) status = "upcoming";
  else if (minutesPast > MISSED_AFTER_MINUTES) status = "missed";
  else if (minutesPast > LATE_AFTER_MINUTES) status = "late";
  else if (snoozedUntil && snoozedUntil > now) status = "snoozed";
  else status = "due";

  return {
    status,
    takenAt: taken[0]?.logged_at ?? null,
    takenBy: taken[0]?.logged_by ?? null,
    takenCount: taken.length,
    snoozeCount: snoozes.length,
    snoozedUntil: snoozedUntil?.toISOString() ?? null,
    hasLateLog: sorted.some((log) => log.status === "late"),
    hasMissedLog: sorted.some((log) => log.status === "missed"),
  };
}

// The columns to select for buildDoses.
export const MED_COLUMNS =
  "id, name, dose, shape, color, instructions, storage_note, source, active, created_at, schedules(time_of_day, days_of_week)";
export const LOG_COLUMNS = "id, medication_id, scheduled_for, status, logged_at, logged_by";

// How many days back the missed-dose checker looks.
const SWEEP_DAYS = 7;

// Missed-dose checker: writes "late" and "missed" rows (logged_by = auto) for doses
// nobody answered, so the records stay accurate even if the patient never opens the app.
// Works with either the caregiver's own client (Row Level Security) or the server's admin client.
// Returns how many rows it added.
export async function sweepPatient(
  supabase: SupabaseClient,
  patientId: string,
  now = new Date()
): Promise<number> {
  const dates = lastDays(SWEEP_DAYS, now);
  const [medsResult, logsResult] = await Promise.all([
    supabase.from("medications").select(MED_COLUMNS).eq("patient_id", patientId),
    supabase
      .from("intake_logs")
      .select(LOG_COLUMNS)
      .eq("patient_id", patientId)
      .gte("scheduled_for", dayStartISO(dates[0])),
  ]);
  if (medsResult.error) throw new Error(medsResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  const doses = buildDoses(
    medsResult.data as MedForDoses[],
    logsResult.data as LogForDoses[],
    dates,
    now
  );

  const rows = [];
  for (const dose of doses) {
    const base = {
      patient_id: patientId,
      medication_id: dose.med.id,
      scheduled_for: dose.scheduledFor,
      logged_by: "auto",
    };
    if (dose.status === "missed" && !dose.hasMissedLog) rows.push({ ...base, status: "missed" });
    else if (dose.status === "late" && !dose.hasLateLog) rows.push({ ...base, status: "late" });
  }
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("intake_logs").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
