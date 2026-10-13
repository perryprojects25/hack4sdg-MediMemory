// Shapes of the rows in our Supabase tables (see supabase/schema.sql).

export type Caregiver = {
  id: string;
  email: string;
  name: string;
};

export type Patient = {
  id: string;
  caregiver_id: string;
  name: string;
  age: number | null;
  preferred_language: "en" | "zh";
  pin: string | null; // null until setup is finished
  username: string | null; // patient signs in with username + PIN
  notes: string | null;
};

export type Schedule = {
  id: string;
  medication_id: string;
  time_of_day: string; // "08:00:00"
  days_of_week: number[]; // 0 = Sunday ... 6 = Saturday
};

export type Medication = {
  id: string;
  patient_id: string;
  name: string;
  dose: string;
  form: string | null;
  shape: string | null;
  color: string | null;
  instructions: string | null;
  storage_note: string | null;
  source: "manual" | "HA_demo";
  active: boolean;
  created_at: string;
  schedules: Schedule[];
};
