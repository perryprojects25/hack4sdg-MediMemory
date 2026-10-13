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

// The prototype supports one patient per caregiver: we use the first one.
export async function loadPatient(caregiverId: string): Promise<Patient | null> {
  const supabase = getSupabaseBrowser();
  return maybe(
    await supabase
      .from("patients")
      .select("*")
      .eq("caregiver_id", caregiverId)
      .order("created_at")
      .limit(1)
      .maybeSingle<Patient>()
  );
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
