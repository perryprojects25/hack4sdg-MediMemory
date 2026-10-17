// POST /api/safety  { patientId, language }  (header: Authorization: Bearer <caregiver token>)
// AI medicine safety check for the dashboard: looks at the patient's whole active
// medicine list for possible interactions, double-ups, doses to ask about, and
// medicines that need extra care at an older age (lib/safety-server.ts).
// Results are things to ask the pharmacist about, never advice.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEMO_CAREGIVER, DEMO_MODE } from "@/lib/demo-mode";
import { aiSafetyCheck } from "@/lib/safety-server";
import type { SafetyResult } from "@/lib/safety";

export const maxDuration = 60; // seconds; the AI call can take a while

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    // Who is asking? Only the caregiver, for their own patient.
    // Demo mode: nobody signs in; it is always the demo caregiver.
    let caregiverId: string = DEMO_CAREGIVER.id;
    if (!DEMO_MODE) {
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
      const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
      if (!auth.user) return Response.json({ error: "unauthorised" }, { status: 401 });
      caregiverId = auth.user.id;
    }

    const { patientId, language } = await request.json();
    const { data: patient } = await supabase
      .from("patients")
      .select("id, caregiver_id, age")
      .eq("id", patientId)
      .maybeSingle();
    if (!patient || patient.caregiver_id !== caregiverId) {
      return Response.json({ error: "unauthorised" }, { status: 401 });
    }

    const { data: meds, error } = await supabase
      .from("medications")
      .select("name, dose, form, instructions, active, schedules(time_of_day)")
      .eq("patient_id", patient.id)
      .order("created_at");
    if (error) throw new Error(error.message);

    const findings = await aiSafetyCheck(patient.age, meds ?? [], language === "zh" ? "zh" : "en");
    // AI unavailable: the app's own (rule-based) checks still show on the dashboard.
    if (findings === null) return Response.json({ error: "ai_unavailable" }, { status: 503 });

    const result: SafetyResult = { findings, checkedAt: new Date().toISOString() };
    return Response.json(result);
  } catch (err) {
    console.error("safety check failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
