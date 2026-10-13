-- =====================================================================
-- MediMemory update 002: patient usernames + doctor sign-in
-- Paste into Supabase: SQL Editor > New query > Run. Safe to run once
-- on a database that already has supabase/schema.sql.
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
