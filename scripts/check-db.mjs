// Checks that the Supabase tables from supabase/schema.sql exist and are protected.
// Run with:  npm run check-db

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.log("❌ Missing Supabase keys. Fill in the three SUPABASE values in .env.local first.");
  process.exit(1);
}

const tables = [
  "caregivers",
  "patients",
  "medications",
  "schedules",
  "intake_logs",
  "caregiver_notes",
  "summaries",
];

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

let ok = true;
for (const table of tables) {
  // 1. The server (service role) must be able to read the table.
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) {
    ok = false;
    console.log(`❌ ${table}: ${error.message}`);
    continue;
  }

  // 2. An anonymous visitor must NOT be able to read any rows.
  const { data: anonRows, error: anonError } = await anon.from(table).select("*").limit(1);
  const blocked = Boolean(anonError) || (anonRows ?? []).length === 0;
  if (!blocked) ok = false;

  console.log(
    `${blocked ? "✅" : "❌"} ${table}: exists (${count} rows), ` +
      (blocked ? "hidden from anonymous visitors" : "VISIBLE to anonymous visitors!")
  );
}

console.log(ok ? "\nAll good: the database is ready." : "\nSomething is not right, see the ❌ lines above.");
process.exit(ok ? 0 : 1);
