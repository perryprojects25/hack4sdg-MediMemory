// Reading and saving the caregiver's data in Supabase, from the browser.
// Row Level Security (supabase/schema.sql) makes sure a caregiver only
// ever reaches their own patient and medicines.

import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "./supabase/client";
import type { Caregiver, Medication, Patient } from "./types";
import hospitalDemo from "@/data/hospital-demo.json";

// Remembered between "send link" and "came back from the email",
// so we can save the caregiver's name after they sign in.
export const PENDING_NAME_KEY = "medimemory-pending-name";

type Result<T> = { data: T | null; error: { message: string } | null };

// Throw a plain Error if Supabase returned one, so callers can catch it.
// "maybe" allows an empty result; "must" expects data to be there.
function maybe<T>(result: Result<T>): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function must<T>(result: Result<T>): T {
  const data = maybe(result);
  if (data === null) throw new Error("No data returned");
  return data;
}

// Make sure the signed-in user has a caregivers row, creating it on first sign in.
export async function ensureCaregiver(user: User): Promise<Caregiver> {
  const supabase = getSupabaseBrowser();
  const existing = maybe(
    await supabase.from("caregivers").select("*").eq("id", user.id).maybeSingle<Caregiver>()
  );
  if (existing) return existing;

  let name: string | null = null;
  try {
    name = localStorage.getItem(PENDING_NAME_KEY);
  } catch {}
  name = name || (user.user_metadata?.name as string | undefined) || user.email!.split("@")[0];

  const created = must(
    await supabase
      .from("caregivers")
      .insert({ id: user.id, email: user.email, name })
      .select()
      .single<Caregiver>()
  );
  try {
    localStorage.removeItem(PENDING_NAME_KEY);
  } catch {}
  return created;
}

// A caregiver can look after more than one person (e.g. a real patient and the demo).
// The one currently shown is remembered on this device.
const SELECTED_PATIENT_KEY = "medimemory-selected-patient";

export function selectPatient(patientId: string) {
  try {
    localStorage.setItem(SELECTED_PATIENT_KEY, patientId);
  } catch {}
}

export async function loadPatients(caregiverId: string): Promise<Patient[]> {
  const supabase = getSupabaseBrowser();
  return must(
    await supabase.from("patients").select("*").eq("caregiver_id", caregiverId).order("created_at").returns<Patient[]>()
  );
}

// The selected patient, or the first one.
export async function loadPatient(caregiverId: string): Promise<Patient | null> {
  const patients = await loadPatients(caregiverId);
  let selected: string | null = null;
  try {
    selected = localStorage.getItem(SELECTED_PATIENT_KEY);
  } catch {}
  return patients.find((p) => p.id === selected) ?? patients[0] ?? null;
}

export async function savePatient(
  caregiverId: string,
  existingId: string | null,
  fields: Pick<Patient, "name" | "age" | "preferred_language" | "notes">
): Promise<Patient> {
  const supabase = getSupabaseBrowser();
  const query = existingId
    ? supabase.from("patients").update(fields).eq("id", existingId)
    : supabase.from("patients").insert({ ...fields, caregiver_id: caregiverId });
  return must(await query.select().single<Patient>());
}

export async function savePin(patientId: string, pin: string): Promise<Patient> {
  const supabase = getSupabaseBrowser();
  return must(
    await supabase.from("patients").update({ pin }).eq("id", patientId).select().single<Patient>()
  );
}

export async function loadMedications(patientId: string): Promise<Medication[]> {
  const supabase = getSupabaseBrowser();
  const meds = must(
    await supabase
      .from("medications")
      .select("*, schedules(*)")
      .eq("patient_id", patientId)
      .order("created_at")
      .returns<Medication[]>()
  );
  // Show each medicine's times in order.
  for (const med of meds) {
    med.schedules.sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
  }
  return meds;
}

export type NewMedication = {
  name: string;
  dose: string;
  form: string;
  shape: string;
  color: string;
  instructions: string | null;
  storage_note: string | null;
  source: "manual" | "HA_demo";
  times: string[]; // "08:00"
};

// Save one medicine and its daily times.
export async function addMedication(patientId: string, med: NewMedication): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { times, ...fields } = med;
  const saved = must(
    await supabase
      .from("medications")
      .insert({ ...fields, patient_id: patientId })
      .select("id")
      .single<{ id: string }>()
  );

  const { error } = await supabase
    .from("schedules")
    .insert(times.map((time) => ({ medication_id: saved.id, time_of_day: time })));
  if (error) {
    // Don't leave a medicine without times behind.
    await supabase.from("medications").delete().eq("id", saved.id);
    throw new Error(error.message);
  }
}

export async function deleteMedication(medicationId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  // Its schedules are deleted automatically (on delete cascade).
  maybe(await supabase.from("medications").delete().eq("id", medicationId));
}

// SIMULATED hospital import: copies the sample prescription in data/hospital-demo.json.
export async function importHospitalDemo(patientId: string): Promise<void> {
  for (const item of hospitalDemo.items) {
    await addMedication(patientId, { ...item, source: "HA_demo" });
  }
}

// A random 4-digit PIN, e.g. "0427".
export function generatePin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return n.toString().padStart(4, "0");
}

// ---------------------------------------------------------------------------
// Dashboard helpers (Step 6)
// ---------------------------------------------------------------------------

export type IntakeLog = {
  id: string;
  medication_id: string;
  scheduled_for: string;
  status: string;
  logged_at: string;
  logged_by: string;
};

export type CaregiverNote = { id: string; patient_id: string; note: string; created_at: string };

export async function loadLogs(patientId: string, sinceISO: string): Promise<IntakeLog[]> {
  const supabase = getSupabaseBrowser();
  return must(
    await supabase
      .from("intake_logs")
      .select("id, medication_id, scheduled_for, status, logged_at, logged_by")
      .eq("patient_id", patientId)
      .gte("scheduled_for", sinceISO)
      .order("logged_at")
      .returns<IntakeLog[]>()
  );
}

// "Mark as taken" by the caregiver, e.g. the patient took it but forgot to press the button.
// Returns false if the dose was already recorded as taken (no double logging).
export async function markTakenByCaregiver(
  patientId: string,
  medicationId: string,
  scheduledFor: string
): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  const existing = must(
    await supabase
      .from("intake_logs")
      .select("id")
      .eq("medication_id", medicationId)
      .eq("scheduled_for", scheduledFor)
      .eq("status", "taken")
      .limit(1)
  );
  if (existing.length > 0) return false;
  must(
    await supabase
      .from("intake_logs")
      .insert({
        patient_id: patientId,
        medication_id: medicationId,
        scheduled_for: scheduledFor,
        status: "taken",
        logged_by: "caregiver",
      })
      .select("id")
  );
  return true;
}

// Edit a medicine and replace its daily times.
export async function updateMedication(
  medicationId: string,
  med: Omit<NewMedication, "source">
): Promise<void> {
  const supabase = getSupabaseBrowser();
  const { times, ...fields } = med;
  must(await supabase.from("medications").update(fields).eq("id", medicationId).select("id"));
  must(await supabase.from("schedules").delete().eq("medication_id", medicationId).select("id"));
  must(
    await supabase
      .from("schedules")
      .insert(times.map((time) => ({ medication_id: medicationId, time_of_day: time })))
      .select("id")
  );
}

export async function setMedicationActive(medicationId: string, active: boolean): Promise<void> {
  const supabase = getSupabaseBrowser();
  must(await supabase.from("medications").update({ active }).eq("id", medicationId).select("id"));
}

export async function loadNotes(patientId: string): Promise<CaregiverNote[]> {
  const supabase = getSupabaseBrowser();
  return must(
    await supabase
      .from("caregiver_notes")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .returns<CaregiverNote[]>()
  );
}

export async function addNote(patientId: string, note: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  must(await supabase.from("caregiver_notes").insert({ patient_id: patientId, note }).select("id"));
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  maybe(await supabase.from("caregiver_notes").delete().eq("id", noteId));
}

// SIMULATED "Prescription sync": adds sample hospital medicines that aren't there yet.
// Returns how many were added.
export async function syncHospitalDemo(patientId: string, current: Medication[]): Promise<number> {
  const existing = new Set(current.filter((m) => m.source === "HA_demo").map((m) => m.name));
  let added = 0;
  for (const item of hospitalDemo.items) {
    if (existing.has(item.name)) continue;
    await addMedication(patientId, { ...item, source: "HA_demo" });
    added++;
  }
  return added;
}
