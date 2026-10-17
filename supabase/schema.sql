-- =====================================================================
-- MediMemory database (Step 2)
-- Paste this whole file into Supabase: SQL Editor > New query > Run.
-- Run it ONCE on a fresh project.
--
-- How access works (Row Level Security):
--   * Caregivers sign in with Supabase Auth (magic link). A signed-in caregiver
--     can only see and change their OWN patients and everything belonging to them.
--   * The patient screen (PIN) and the doctor page (share link) do NOT sign in.
--     They go through our server code, which checks the PIN or link token
--     and then uses the secret service role key. So anonymous visitors
--     get no direct access to any table.
-- All times are stored as "timestamptz" (absolute moments); the app shows them
-- in Hong Kong time.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. caregivers: one row per family caregiver, linked to their login.
-- ---------------------------------------------------------------------
create table caregivers (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. patients: the older person being cared for.
-- ---------------------------------------------------------------------
create table patients (
  id                 uuid primary key default gen_random_uuid(),
  caregiver_id       uuid not null references caregivers (id) on delete cascade,
  name               text not null,
  age                int check (age between 0 and 130),
  preferred_language text not null default 'zh' check (preferred_language in ('en', 'zh')),
  -- 4 digit PIN for the patient screen. Only ever checked by server code.
  -- (Prototype: stored as plain text. A real app would store a hash.)
  pin                text check (pin ~ '^[0-9]{4}$'),
  notes              text,
  created_at         timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. medications: each medicine a patient takes, with how it looks.
-- ---------------------------------------------------------------------
create table medications (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients (id) on delete cascade,
  name         text not null,                 -- e.g. "Metformin"
  dose         text not null,                 -- e.g. "500 mg, 1 tablet"
  form         text,                          -- e.g. tablet, capsule, liquid
  shape        text,                          -- e.g. round, oval, capsule
  color        text,                          -- e.g. white, red
  instructions text,                          -- e.g. "Take with food"
  storage_note text,                          -- e.g. "Keep in a cool dry place"
  source       text not null default 'manual' check (source in ('manual', 'HA_demo')),
  active       boolean not null default true, -- false = paused
  created_at   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. schedules: when each medicine should be taken (one row per time of day).
-- ---------------------------------------------------------------------
create table schedules (
  id            uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications (id) on delete cascade,
  time_of_day   time not null,                              -- e.g. 08:00, Hong Kong time
  days_of_week  smallint[] not null default '{0,1,2,3,4,5,6}' -- 0 = Sunday ... 6 = Saturday
                check (days_of_week <@ '{0,1,2,3,4,5,6}'),
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 5. intake_logs: what actually happened for each scheduled dose.
--    (No "one row per dose" rule here on purpose: a snoozed dose gets
--    several rows, and the demo data needs to show a double dose.
--    The app itself stops accidental double logging.)
-- ---------------------------------------------------------------------
create table intake_logs (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients (id) on delete cascade,
  medication_id uuid not null references medications (id) on delete cascade,
  scheduled_for timestamptz not null,     -- the dose time this log is about
  status        text not null check (status in ('taken', 'late', 'missed', 'snoozed', 'skipped')),
  logged_at     timestamptz not null default now(),
  logged_by     text not null check (logged_by in ('patient', 'caregiver', 'auto'))
);

create index intake_logs_patient_time on intake_logs (patient_id, scheduled_for);
create index intake_logs_medication_time on intake_logs (medication_id, scheduled_for);


-- ---------------------------------------------------------------------
-- 6. caregiver_notes: free-text observations ("Mum felt dizzy Tuesday").
-- ---------------------------------------------------------------------
create table caregiver_notes (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  note       text not null,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 7. summaries: AI doctor summaries, shared via an unguessable link.
--    To revoke a doctor link, set share_token to null (or delete the row).
-- ---------------------------------------------------------------------
create table summaries (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients (id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  content_json jsonb not null,
  -- 64 random hex characters, made from two random UUIDs.
  share_token  text unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at   timestamptz not null default now(),
  check (period_end >= period_start)
);


-- =====================================================================
-- Row Level Security
-- =====================================================================

-- Helper: true if the signed-in caregiver owns this patient.
-- "security definer" lets it read the patients table without RLS loops.
create function is_my_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from patients
    where id = p_patient_id and caregiver_id = auth.uid()
  );
$$;

alter table caregivers      enable row level security;
alter table patients        enable row level security;
alter table medications     enable row level security;
alter table schedules       enable row level security;
alter table intake_logs     enable row level security;
alter table caregiver_notes enable row level security;
alter table summaries       enable row level security;

-- Caregivers: only your own profile row.
create policy "Caregivers manage own profile" on caregivers
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Patients: only patients you look after.
create policy "Caregivers manage own patients" on patients
  for all to authenticated
  using (caregiver_id = auth.uid())
  with check (caregiver_id = auth.uid());

-- Medications, logs, notes, summaries: only for your own patients.
create policy "Caregivers manage own patients' medications" on medications
  for all to authenticated
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id));

create policy "Caregivers manage own patients' intake logs" on intake_logs
  for all to authenticated
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id));

create policy "Caregivers manage own patients' notes" on caregiver_notes
  for all to authenticated
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id));

create policy "Caregivers manage own patients' summaries" on summaries
  for all to authenticated
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id));

-- Schedules belong to a medication, so check through the medication.
create policy "Caregivers manage own patients' schedules" on schedules
  for all to authenticated
  using (exists (select 1 from medications m where m.id = medication_id and is_my_patient(m.patient_id)))
  with check (exists (select 1 from medications m where m.id = medication_id and is_my_patient(m.patient_id)));


-- =====================================================================
-- Table permissions
-- Signed-in caregivers can use the tables (RLS above limits WHICH rows).
-- Server code uses the service role. Anonymous visitors get nothing.
-- =====================================================================
grant select, insert, update, delete on
  caregivers, patients, medications, schedules, intake_logs, caregiver_notes, summaries
  to authenticated;

grant all on
  caregivers, patients, medications, schedules, intake_logs, caregiver_notes, summaries
  to service_role;

revoke all on
  caregivers, patients, medications, schedules, intake_logs, caregiver_notes, summaries
  from anon;

revoke execute on function is_my_patient(uuid) from public, anon;
grant execute on function is_my_patient(uuid) to authenticated, service_role;


-- =====================================================================
-- Update 002 (also in supabase/migrations/002_usernames_and_doctor_sharing.sql)
-- =====================================================================
-- 1. Patients sign in with a username + PIN (no link needed).
--    A username can be shared by several patients and so can a PIN,
--    but each username + PIN pair must be unique.
alter table patients add column if not exists username text
  check (username ~ '^[a-z0-9]{3,20}$');

create unique index if not exists patients_username_pin_unique
  on patients (username, pin);

-- Give existing patients a starting username from their name, e.g. "Mrs. Chan" -> "mrschan".
-- (Names too short for a username get "patient" + the first 4 characters of their id.)
update patients
set username = case
  when length(lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))) >= 3
    then left(lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')), 20)
  else 'patient' || left(replace(id::text, '-', ''), 4)
end
where username is null;


-- 2. Doctors sign in by email and see summaries a caregiver shared with that email.
alter table summaries add column if not exists doctor_email text;

create index if not exists summaries_doctor_email on summaries (lower(doctor_email));

drop policy if exists "Doctors read summaries shared with them" on summaries;
create policy "Doctors read summaries shared with them" on summaries
  for select to authenticated
  using (
    doctor_email is not null
    and share_token is not null -- revoked summaries disappear for the doctor too
    and lower(doctor_email) = lower(auth.jwt() ->> 'email')
  );
