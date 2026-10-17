// Server side of HACKATHON DEMO MODE (see lib/demo-mode.ts).
// With no signed-in user, Row Level Security would block the browser. So in demo mode
// the browser sends its database requests here, and we run them with the service role
// key (which never leaves the server), limited to the demo caregiver's own data.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase/admin";
import { DEMO_CAREGIVER, DEMO_MODE, DEMO_PATIENT_ID } from "./demo-mode";
import type { Caregiver } from "./types";

// ---------------------------------------------------------------------------
// The fixed demo caregiver
// ---------------------------------------------------------------------------

let ready: Promise<Caregiver> | null = null;

// Makes sure the demo caregiver exists. caregivers.id must match a row in Supabase's
// user list, so a user record is created once with the admin API. Creating it this way
// does NOT send any email, and nobody ever signs in with it.
export function ensureDemoCaregiver(): Promise<Caregiver> {
  ready ??= (async () => {
    const supabase = getSupabaseAdmin();
    const { data: found } = await supabase.auth.admin.getUserById(DEMO_CAREGIVER.id);
    if (!found?.user) {
      const { error } = await supabase.auth.admin.createUser({
        id: DEMO_CAREGIVER.id,
        email: DEMO_CAREGIVER.email,
        email_confirm: true, // marked as confirmed, so no confirmation email
        user_metadata: { name: DEMO_CAREGIVER.name },
      });
      if (error) throw new Error(`Could not create the demo caregiver: ${error.message}`);
    }
    const { data, error } = await supabase
      .from("caregivers")
      .upsert({ id: DEMO_CAREGIVER.id, email: DEMO_CAREGIVER.email, name: DEMO_CAREGIVER.name })
      .select()
      .single<Caregiver>();
    if (error) throw new Error(error.message);
    return data;
  })().catch((err) => {
    ready = null; // try again next time
    throw err;
  });
  return ready;
}

async function demoPatientIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("patients").select("id").eq("caregiver_id", DEMO_CAREGIVER.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}

async function demoMedicationIds(supabase: SupabaseClient): Promise<string[]> {
  const patientIds = await demoPatientIds(supabase);
  const { data, error } = await supabase.from("medications").select("id").in("patient_id", patientIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}

export async function isDemoPatient(patientId: string): Promise<boolean> {
  return (await demoPatientIds(getSupabaseAdmin())).includes(patientId);
}

// The patient used on the patient screen: Mrs. Chan if loaded, otherwise the first person added.
export async function resolveDemoPatientId(): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("patients")
    .select("id")
    .eq("caregiver_id", DEMO_CAREGIVER.id)
    .order("created_at");
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => row.id);
  return ids.includes(DEMO_PATIENT_ID) ? DEMO_PATIENT_ID : (ids[0] ?? null);
}

// ---------------------------------------------------------------------------
// Running the browser's database requests (POST /api/demo/db)
// ---------------------------------------------------------------------------

export type DemoCall = { method: string; args: unknown[] };

// For each table: which column ties a row to the demo caregiver.
const OWNER_COLUMN: Record<string, "id" | "caregiver_id" | "patient_id" | "medication_id"> = {
  caregivers: "id",
  patients: "caregiver_id",
  medications: "patient_id",
  intake_logs: "patient_id",
  caregiver_notes: "patient_id",
  summaries: "patient_id",
  schedules: "medication_id",
};
const ACTIONS = new Set(["select", "insert", "update", "delete"]);
const MODIFIERS = new Set([
  "select", "eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "not",
  "order", "limit", "range", "single", "maybeSingle",
]);

class Refused extends Error {}

type Row = Record<string, unknown>;
type Builder = Record<string, (...args: unknown[]) => Builder> & PromiseLike<{ data: unknown; error: unknown; count?: number | null }>;

export async function runDemoQuery(table: unknown, calls: unknown) {
  if (!DEMO_MODE) throw new Refused("Demo mode is off");
  if (typeof table !== "string" || !(table in OWNER_COLUMN)) throw new Refused("Unknown table");
  if (!Array.isArray(calls) || calls.length === 0) throw new Refused("No query");

  const [first, ...rest] = calls as DemoCall[];
  if (!ACTIONS.has(first?.method)) throw new Refused("Unknown action");
  if (table === "caregivers" && first.method !== "select") throw new Refused("Read only");

  const supabase = getSupabaseAdmin();
  const column = OWNER_COLUMN[table];
  const allowed =
    column === "id" || column === "caregiver_id"
      ? [DEMO_CAREGIVER.id]
      : column === "patient_id"
        ? await demoPatientIds(supabase)
        : await demoMedicationIds(supabase);

  const args = [...first.args];
  if (first.method === "insert") {
    // New rows must belong to the demo caregiver.
    const rows = (Array.isArray(args[0]) ? args[0] : [args[0]]) as Row[];
    for (const row of rows) {
      if (column === "caregiver_id") row.caregiver_id = DEMO_CAREGIVER.id;
      else if (!allowed.includes(String(row[column]))) throw new Refused("Not a demo row");
    }
  }
  if (first.method === "update") {
    // Rows can't be moved to someone else.
    const changes = { ...(args[0] as Row) };
    delete changes[column];
    args[0] = changes;
  }

  let query = (supabase.from(table) as unknown as Builder)[first.method](...args);
  // Reading, changing or deleting: only the demo caregiver's rows.
  if (first.method !== "insert") query = query.in(column, allowed);

  for (const call of rest) {
    if (call.method === "returns") continue; // a TypeScript-only helper
    if (!MODIFIERS.has(call.method)) throw new Refused(`Not allowed: ${call.method}`);
    query = query[call.method](...(call.args ?? []));
  }
  return await query;
}

export function isRefused(err: unknown) {
  return err instanceof Refused;
}
