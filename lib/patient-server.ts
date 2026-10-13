// Server-only helpers for the patient screen.
// The patient never signs in to Supabase. Instead, every request sends the
// patient id (from their personal link) and their 4-digit PIN, and we check
// both here before using the service role key.

import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import {
  MAX_SNOOZES,
  MISSED_AFTER_MINUTES,
  SNOOZE_MINUTES,
  TIME_ZONE,
  UTC_OFFSET,
} from "./dose-rules";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINUTE = 60 * 1000;

export type PatientInfo = { id: string; name: string; preferred_language: "en" | "zh" };

// What the patient screen needs to know about each of today's doses.
export type DoseStatus =
  | "upcoming" // not time yet
  | "due" // time to take it now
  | "snoozed" // "Remind me later" was pressed
  | "taken"
  | "closed"; // missed or skipped, or too long ago to take now

export type Dose = {
  medicationId: string;
  name: string;
  dose: string;
  shape: string | null;
  color: string | null;
  instructions: string | null;
  scheduledFor: string; // ISO time
  status: DoseStatus;
  takenAt: string | null;
  snoozeCount: number;
  snoozedUntil: string | null;
};

// Today's date in Hong Kong, e.g. "2026-10-13".
function hongKongDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

type LogRow = { medication_id: string; scheduled_for: string; status: string; logged_at: string };
type MedRow = {
  id: string;
  name: string;
  dose: string;
  shape: string | null;
  color: string | null;
  instructions: string | null;
  active: boolean;
  schedules: { time_of_day: string; days_of_week: number[] }[];
};

// Checks the id and PIN and, if they match, returns the patient and today's doses.
// Returns null if they don't match. Everything is fetched in ONE round trip to the
// database (two queries side by side) so the patient screen stays quick.
export async function loadPatientDay(
  id: unknown,
  pin: unknown,
  now = new Date()
): Promise<{ patient: PatientInfo; doses: Dose[] } | null> {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return null;
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) return null;

  const supabase = getSupabaseAdmin();
  const today = hongKongDate(now);
  const dayStart = new Date(`${today}T00:00:00${UTC_OFFSET}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MINUTE);
  // Noon in Hong Kong is still the same date in UTC, so getUTCDay gives the Hong Kong weekday.
  const weekday = new Date(`${today}T12:00:00${UTC_OFFSET}`).getUTCDay();

  const [patientResult, logsResult] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, name, preferred_language, pin, medications(id, name, dose, shape, color, instructions, active, schedules(time_of_day, days_of_week))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("intake_logs")
      .select("medication_id, scheduled_for, status, logged_at")
      .eq("patient_id", id)
      .gte("scheduled_for", dayStart.toISOString())
      .lt("scheduled_for", dayEnd.toISOString()),
  ]);
  if (patientResult.error) throw new Error(patientResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  const row = patientResult.data;
  if (!row || row.pin !== pin) return null; // the logs are thrown away if the PIN is wrong
  const logs = (logsResult.data ?? []) as LogRow[];

  const doses: Dose[] = [];
  for (const med of (row.medications ?? []) as MedRow[]) {
    if (!med.active) continue;
    for (const schedule of med.schedules) {
      if (!schedule.days_of_week.includes(weekday)) continue;

      const scheduledFor = new Date(`${today}T${schedule.time_of_day}${UTC_OFFSET}`);
      const doseLogs = logs.filter(
        (log) =>
          log.medication_id === med.id &&
          new Date(log.scheduled_for).getTime() === scheduledFor.getTime()
      );
      doses.push({
        medicationId: med.id,
        name: med.name,
        dose: med.dose,
        shape: med.shape,
        color: med.color,
        instructions: med.instructions,
        scheduledFor: scheduledFor.toISOString(),
        ...doseState(scheduledFor, doseLogs, now),
      });
    }
  }

  return {
    patient: { id: row.id, name: row.name, preferred_language: row.preferred_language },
    doses: doses.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
  };
}

function doseState(scheduledFor: Date, logs: LogRow[], now: Date) {
  const taken = logs.find((log) => log.status === "taken");
  const snoozes = logs.filter((log) => log.status === "snoozed");
  const lastSnooze = snoozes.map((log) => new Date(log.logged_at).getTime()).sort().at(-1);
  const snoozedUntil = lastSnooze ? new Date(lastSnooze + SNOOZE_MINUTES * MINUTE) : null;

  let status: DoseStatus;
  if (taken) status = "taken";
  else if (logs.some((log) => log.status === "missed" || log.status === "skipped")) status = "closed";
  else if (now < scheduledFor) status = "upcoming";
  else if (now.getTime() > scheduledFor.getTime() + MISSED_AFTER_MINUTES * MINUTE) status = "closed";
  else if (snoozedUntil && snoozedUntil > now) status = "snoozed";
  else status = "due";

  return {
    status,
    takenAt: taken?.logged_at ?? null,
    snoozeCount: snoozes.length,
    snoozedUntil: snoozedUntil?.toISOString() ?? null,
  };
}

export type LogResult =
  | { result: "taken"; takenAt: string }
  | { result: "alreadyTaken"; takenAt: string }
  | { result: "snoozed"; until: string }
  | { result: "maxSnoozes" }
  | { result: "invalid" };

// Records "I took it" or "Remind me later" for one dose.
// Refuses to record a second "taken" for the same dose (prevents double dosing).
export async function logDose(
  patientId: string,
  todayDoses: Dose[],
  medicationId: unknown,
  scheduledForInput: unknown,
  action: unknown,
  viaVoice: boolean
): Promise<LogResult> {
  if (typeof medicationId !== "string" || !UUID_PATTERN.test(medicationId)) return { result: "invalid" };
  if (typeof scheduledForInput !== "string") return { result: "invalid" };
  if (action !== "taken" && action !== "snooze") return { result: "invalid" };

  // Only accept doses that really are on today's list for this patient.
  const dose = todayDoses.find(
    (d) => d.medicationId === medicationId && d.scheduledFor === new Date(scheduledForInput).toISOString()
  );
  if (!dose) return { result: "invalid" };

  if (dose.status === "taken") return { result: "alreadyTaken", takenAt: dose.takenAt! };
  if (dose.status !== "due" && dose.status !== "snoozed") return { result: "invalid" };

  const supabase = getSupabaseAdmin();
  const base = { patient_id: patientId, medication_id: medicationId, scheduled_for: dose.scheduledFor };

  if (action === "snooze") {
    if (dose.snoozeCount >= MAX_SNOOZES) return { result: "maxSnoozes" };
    const { data, error } = await supabase
      .from("intake_logs")
      .insert({ ...base, status: "snoozed", logged_by: "patient" })
      .select("logged_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      result: "snoozed",
      until: new Date(new Date(data.logged_at).getTime() + SNOOZE_MINUTES * MINUTE).toISOString(),
    };
  }

  const { data, error } = await supabase
    .from("intake_logs")
    .insert({ ...base, status: "taken", logged_by: viaVoice ? "voice" : "patient" })
    .select("logged_at")
    .single();
  if (error) throw new Error(error.message);
  return { result: "taken", takenAt: data.logged_at };
}
