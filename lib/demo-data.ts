// "Load demo data": a realistic, FICTIONAL story so the app can be demoed in
// 3 minutes. Mrs. Chan, 78, Cantonese speaking, with 30 days of history:
//   - mostly taken, some taken late, some confirmed by voice or by the caregiver
//   - evening doses missed more often at weekends
//   - one day with a possible double dose
//   - a 2-day gap with nothing confirmed (the phone was left elsewhere)
//   - two aspirin products, so the duplicate warning appears
// Saved with the caregiver's own sign-in (Row Level Security applies).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "./supabase/client";
import { generatePin, selectPatient } from "./caregiver-data";
import { addDays, hongKongDate, weekdayOf } from "./doses";
import { UTC_OFFSET } from "./dose-rules";
import type { Patient } from "./types";

// Marks the demo patient so "Reset demo" only ever touches demo data.
export const DEMO_MARK = "Demo patient (fictional data)";
const HISTORY_DAYS = 30;
const MINUTE = 60 * 1000;

const DEMO_MEDICINES = [
  {
    name: "Metformin (二甲雙胍)",
    dose: "500 mg, 1 tablet",
    form: "tablet",
    shape: "round",
    color: "white",
    instructions: "For diabetes. Take with breakfast and dinner. 早餐及晚餐時服用。",
    storage_note: "Store below 25°C in a dry place. 存放於攝氏25度以下乾爽處。",
    source: "HA_demo",
    times: ["08:00", "18:00"],
  },
  {
    name: "Amlodipine (氨氯地平)",
    dose: "5 mg, 1 tablet",
    form: "tablet",
    shape: "oval",
    color: "pink",
    instructions: "For blood pressure. Once a day in the morning. 每朝服用一次。",
    storage_note: "Keep in a cool dry place, away from sunlight. 存放於陰涼乾爽處。",
    source: "HA_demo",
    times: ["08:00"],
  },
  {
    name: "Aspirin low dose (低劑量阿士匹靈)",
    dose: "80 mg, 1 tablet",
    form: "tablet",
    shape: "round",
    color: "orange",
    instructions: "Take after breakfast. 早餐後服用。",
    storage_note: "Keep in the original box, in a dry place. 保留在原裝盒內。",
    source: "HA_demo",
    times: ["09:00"],
  },
  {
    // Deliberate possible duplicate: also aspirin, bought separately for knee pain.
    name: "Aspirin 300 mg (pain relief 止痛)",
    dose: "300 mg, 1 tablet",
    form: "tablet",
    shape: "round",
    color: "white",
    instructions: "For knee pain, after lunch. 午餐後服用（膝痛）。",
    storage_note: "Keep in a cool dry place. 存放於陰涼乾爽處。",
    source: "manual",
    times: ["13:00"],
  },
] as const;

// Small repeatable random number generator, so the demo looks the same every time.
function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

// Deletes this caregiver's demo patient(s) and everything belonging to them.
// (The optional client lets tests run this with the server key; the app uses the caregiver's sign-in.)
export async function removeDemo(caregiverId: string, supabase: SupabaseClient = getSupabaseBrowser()): Promise<void> {
  const { error } = await supabase
    .from("patients")
    .delete()
    .eq("caregiver_id", caregiverId)
    .eq("notes", DEMO_MARK);
  if (error) throw new Error(error.message);
}

// Creates (or re-creates) the demo patient with 30 days of history.
export async function loadDemo(
  caregiverId: string,
  now = new Date(),
  supabase: SupabaseClient = getSupabaseBrowser()
): Promise<Patient> {
  await removeDemo(caregiverId, supabase);

  const today = hongKongDate(now);
  const firstDay = addDays(today, -HISTORY_DAYS);
  const startedAt = new Date(`${firstDay}T07:00:00${UTC_OFFSET}`).toISOString();

  // 1. Patient (signs in as "mrschan" + PIN; try another PIN if that pair is taken)
  let patient: Patient | null = null;
  for (let attempt = 0; attempt < 5 && !patient; attempt++) {
    const { data, error } = await supabase
      .from("patients")
      .insert({
        caregiver_id: caregiverId,
        name: "Mrs. Chan",
        age: 78,
        preferred_language: "zh",
        username: "mrschan",
        pin: generatePin(),
        notes: DEMO_MARK,
        created_at: startedAt,
      })
      .select()
      .single<Patient>();
    if (error && error.code !== "23505") throw new Error(error.message);
    patient = data;
  }
  if (!patient) throw new Error("Could not create the demo patient");

  // 2. Medicines and their daily times (added 30 days ago)
  const meds: { id: string; times: readonly string[] }[] = [];
  for (const med of DEMO_MEDICINES) {
    const { times, ...fields } = med;
    const { data, error } = await supabase
      .from("medications")
      .insert({ ...fields, patient_id: patient.id, created_at: startedAt })
      .select("id")
      .single<{ id: string }>();
    if (error) throw new Error(error.message);
    const { error: scheduleError } = await supabase
      .from("schedules")
      .insert(times.map((time) => ({ medication_id: data.id, time_of_day: time, created_at: startedAt })));
    if (scheduleError) throw new Error(scheduleError.message);
    meds.push({ id: data.id, times });
  }
  const amlodipine = meds[1];

  // 3. Intake logs
  const random = seededRandom(20261013);
  const gapDays = new Set([addDays(today, -20), addDays(today, -19)]); // phone left elsewhere
  const doubleDoseDay = addDays(today, -12);
  const logs: Record<string, string>[] = [];

  for (let date = firstDay; date <= today; date = addDays(date, 1)) {
    const weekend = [0, 6].includes(weekdayOf(date));
    for (const med of meds) {
      for (const time of med.times) {
        const due = new Date(`${date}T${time}:00${UTC_OFFSET}`).getTime();
        const base = { patient_id: patient.id, medication_id: med.id, scheduled_for: iso(due) };
        const minutesSince = (now.getTime() - due) / MINUTE;

        // Today: only fill in doses whose window has closed; leave the rest for the live demo.
        if (minutesSince < 90) continue;

        const evening = Number(time.slice(0, 2)) >= 17;
        const isDoubleDose = date === doubleDoseDay && med === amlodipine;
        const missChance = isDoubleDose ? 0 : gapDays.has(date) ? 1 : evening && weekend ? 0.55 : evening ? 0.1 : 0.04;

        if (random() < missChance) {
          logs.push({ ...base, status: "late", logged_by: "auto", logged_at: iso(due + 30 * MINUTE) });
          logs.push({ ...base, status: "missed", logged_by: "auto", logged_at: iso(due + 90 * MINUTE) });
          continue;
        }

        // Taken: usually on time, sometimes late; sometimes after a snooze.
        const takenLate = !isDoubleDose && random() < 0.12;
        const delay = takenLate ? 35 + random() * 45 : random() * 20;
        if (random() < 0.1) {
          logs.push({ ...base, status: "snoozed", logged_by: "patient", logged_at: iso(due + 2 * MINUTE) });
        }
        if (takenLate) {
          logs.push({ ...base, status: "late", logged_by: "auto", logged_at: iso(due + 30 * MINUTE) });
        }
        const who = random();
        const loggedBy = isDoubleDose || who < 0.72 ? "patient" : who < 0.86 ? "voice" : "caregiver";
        logs.push({ ...base, status: "taken", logged_by: loggedBy, logged_at: iso(due + delay * MINUTE) });
      }
    }

    // One possible double dose: the patient confirmed the blood pressure tablet,
    // and the caregiver also marked it later the same morning.
    if (date === doubleDoseDay) {
      const due = new Date(`${date}T08:00:00${UTC_OFFSET}`).getTime();
      logs.push({
        patient_id: patient.id,
        medication_id: amlodipine.id,
        scheduled_for: iso(due),
        status: "taken",
        logged_by: "caregiver",
        logged_at: iso(due + 150 * MINUTE),
      });
    }
  }

  for (let i = 0; i < logs.length; i += 500) {
    const { error } = await supabase.from("intake_logs").insert(logs.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }

  // 4. Caregiver notes (dated in the past)
  const note = (daysAgo: number, text: string) => ({
    patient_id: patient.id,
    note: text,
    created_at: new Date(`${addDays(today, -daysAgo)}T21:00:00${UTC_OFFSET}`).toISOString(),
  });
  const { error: notesError } = await supabase.from("caregiver_notes").insert([
    note(25, "Mum said she feels a little dizzy in the mornings since starting the blood pressure tablet."),
    note(18, "Mum's phone was left at my sister's flat for two days, so she did not see any reminders."),
    note(12, "Our helper also marked the morning blood pressure tablet as given. Mum may have taken it twice that day."),
    note(6, "Knee pain worse after the rain. She is taking the pain tablet she bought at the pharmacy most days."),
    note(2, "Running low on Metformin, about 5 days left."),
  ]);
  if (notesError) throw new Error(notesError.message);

  selectPatient(patient.id);
  return patient;
}

// Adds a test medicine with a dose 1 minute from now, to watch a reminder fire.
export async function addTestDose(patientId: string, now = new Date()): Promise<string> {
  const supabase = getSupabaseBrowser();
  const inOneMinute = new Date(now.getTime() + 60 * 1000);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(inOneMinute);

  const { data, error } = await supabase
    .from("medications")
    .insert({
      patient_id: patientId,
      name: "Test reminder (Vitamin D)",
      dose: "1 capsule",
      form: "capsule",
      shape: "capsule",
      color: "yellow",
      instructions: "Test dose for the demo. 示範用測試劑量。",
      storage_note: "Keep in a cool dry place.",
      source: "manual",
      created_at: now.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  const { error: scheduleError } = await supabase.from("schedules").insert({ medication_id: data.id, time_of_day: time });
  if (scheduleError) throw new Error(scheduleError.message);
  return time;
}
