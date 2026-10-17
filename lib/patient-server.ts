// Server-only helpers for the patient screen.
// The patient never signs in to Supabase. Instead, every request sends the
// patient id (from their personal link) and their 4-digit PIN, and we check
// both here before using the service role key.

import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import { EARLY_TAKE_MINUTES, MAX_SNOOZES, SNOOZE_MINUTES, UNDO_MINUTES } from "./dose-rules";
import { DEMO_CAREGIVER, DEMO_MODE } from "./demo-mode";
import { resolveDemoPatientId } from "./demo-server";
import {
  LOG_COLUMNS,
  MED_COLUMNS,
  buildDoses,
  dayStartISO,
  addDays,
  hongKongDate,
  type DoseInstance,
  type LogForDoses,
  type MedForDoses,
} from "./doses";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINUTE = 60 * 1000;

export type PatientInfo = { id: string; name: string; preferred_language: "en" | "zh" };

// The patient screen only needs a simpler status than the caregiver.
export type PatientDoseStatus = "upcoming" | "due" | "snoozed" | "taken" | "closed";

export type Dose = {
  medicationId: string;
  name: string;
  dose: string;
  shape: string | null;
  color: string | null;
  instructions: string | null;
  scheduledFor: string; // ISO time
  status: PatientDoseStatus;
  takenAt: string | null;
  snoozeCount: number;
  snoozedUntil: string | null;
  canTakeNow: boolean; // "I took it" / "I already took it" is allowed
  canUndo: boolean; // "I pressed this by mistake" is still allowed
};

function toPatientDose(d: DoseInstance, now: Date): Dose {
  let status: PatientDoseStatus;
  if (d.status === "taken") status = "taken";
  else if (d.status === "missed" || d.status === "skipped") status = "closed";
  else if (d.status === "upcoming") status = "upcoming";
  // due, late or snoozed: show it again unless a snooze is still running
  else if (d.snoozedUntil && new Date(d.snoozedUntil) > now) status = "snoozed";
  else status = "due";

  const minutesUntil = (new Date(d.scheduledFor).getTime() - now.getTime()) / MINUTE;
  const canTakeNow = status !== "taken" && (status !== "upcoming" || minutesUntil <= EARLY_TAKE_MINUTES);
  // The patient can undo a "taken" (theirs or the family's) only for a short time.
  // After that only the family can, from the dashboard.
  const canUndo = status === "taken" && now.getTime() - new Date(d.takenAt!).getTime() <= UNDO_MINUTES * MINUTE;

  return {
    medicationId: d.med.id,
    name: d.med.name,
    dose: d.med.dose,
    shape: d.med.shape,
    color: d.med.color,
    instructions: d.med.instructions,
    scheduledFor: d.scheduledFor,
    status,
    takenAt: d.takenAt,
    snoozeCount: d.snoozeCount,
    snoozedUntil: d.snoozedUntil,
    canTakeNow,
    canUndo,
  };
}

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

  const [patientResult, logsResult] = await Promise.all([
    supabase
      .from("patients")
      .select(`id, caregiver_id, name, preferred_language, pin, medications(${MED_COLUMNS})`)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("intake_logs")
      .select(LOG_COLUMNS)
      .eq("patient_id", id)
      .gte("scheduled_for", dayStartISO(today))
      .lt("scheduled_for", dayStartISO(addDays(today, 1))),
  ]);
  if (patientResult.error) throw new Error(patientResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  const row = patientResult.data;
  // Demo mode: any 4 digits are accepted, but only for the demo caregiver's people.
  const pinOk = DEMO_MODE ? row?.caregiver_id === DEMO_CAREGIVER.id : row?.pin === pin;
  if (!row || !pinOk) return null; // the logs are thrown away if the PIN is wrong

  const doses = buildDoses(
    (row.medications ?? []) as MedForDoses[],
    (logsResult.data ?? []) as LogForDoses[],
    [today],
    now
  );

  return {
    patient: { id: row.id, name: row.name, preferred_language: row.preferred_language },
    doses: doses.map((d) => toPatientDose(d, now)),
  };
}

// Usernames: 3-20 lowercase letters or numbers.
export const USERNAME_PATTERN = /^[a-z0-9]{3,20}$/;

// Sign in without a link: finds the patient whose username AND PIN both match.
// (Each username + PIN pair is unique in the database.)
export async function findPatientByLogin(username: unknown, pin: unknown): Promise<string | null> {
  // Demo mode: any 4-digit PIN opens the demo patient (Mrs. Chan, or the first person added).
  if (DEMO_MODE) return typeof pin === "string" && /^\d{4}$/.test(pin) ? resolveDemoPatientId() : null;

  if (typeof username !== "string" || typeof pin !== "string") return null;
  const clean = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(clean) || !/^\d{4}$/.test(pin)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("patients")
    .select("id")
    .eq("username", clean)
    .eq("pin", pin)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export type LogResult =
  | { result: "taken"; takenAt: string }
  | { result: "alreadyTaken"; takenAt: string }
  | { result: "snoozed"; until: string }
  | { result: "maxSnoozes" }
  | { result: "undone" }
  | { result: "undoExpired" }
  | { result: "tooEarly"; at: string }
  | { result: "invalid" };

// Records "I took it", "Remind me later" or "I pressed this by mistake" for one dose.
// Refuses to record a second "taken" for the same dose (prevents double dosing),
// and only allows an undo shortly after the patient's own press (UNDO_MINUTES).
export async function logDose(
  patientId: string,
  todayDoses: Dose[],
  medicationId: unknown,
  scheduledForInput: unknown,
  action: unknown,
  viaVoice: boolean
): Promise<LogResult> {
  if (typeof medicationId !== "string" || !UUID_PATTERN.test(medicationId)) return { result: "invalid" };
  if (typeof scheduledForInput !== "string" || isNaN(Date.parse(scheduledForInput))) return { result: "invalid" };
  if (action !== "taken" && action !== "snooze" && action !== "undo") return { result: "invalid" };

  // Only accept doses that really are on today's list for this patient.
  const dose = todayDoses.find(
    (d) => d.medicationId === medicationId && d.scheduledFor === new Date(scheduledForInput).toISOString()
  );
  if (!dose) return { result: "invalid" };

  const supabase = getSupabaseAdmin();
  const base = { patient_id: patientId, medication_id: medicationId, scheduled_for: dose.scheduledFor };

  // "I pressed this by mistake": remove the "taken" record(s) for this dose, if still allowed
  // (the first one was made less than UNDO_MINUTES ago).
  if (action === "undo") {
    if (!dose.canUndo) return { result: "undoExpired" };
    const { error } = await supabase.from("intake_logs").delete().match({ ...base, status: "taken" });
    if (error) throw new Error(error.message);
    return { result: "undone" };
  }

  // Never record a second "taken" for the same dose (prevents double dosing).
  if (dose.status === "taken") return { result: "alreadyTaken", takenAt: dose.takenAt! };

  if (action === "taken") {
    // Too early: more than EARLY_TAKE_MINUTES before its time.
    if (!dose.canTakeNow) return { result: "tooEarly", at: dose.scheduledFor };
    // Due, snoozed, a little early, or missed ("I already took it"): record it.
  } else if (dose.status !== "due" && dose.status !== "snoozed") {
    return { result: "invalid" }; // snoozing only makes sense for a dose that is due
  }

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
