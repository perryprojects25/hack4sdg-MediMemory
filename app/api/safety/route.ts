// POST /api/safety  { patientId, language }  (header: Authorization: Bearer <caregiver token>)
// AI medicine safety check: looks at the patient's whole active medicine list for
// possible interactions, double-ups, doses to ask about, and medicines that need
// extra care at an older age. Only medicine details and an age band are sent to the
// AI, never the name. Results are things to ask the pharmacist about, never advice.

import { AiError, generateJSON } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEMO_CAREGIVER, DEMO_MODE } from "@/lib/demo-mode";
import {
  SAFETY_SYSTEM_PROMPT,
  cleanFindings,
  isAiSafety,
  safetyUserPrompt,
  type SafetyMedicine,
  type SafetyResult,
} from "@/lib/safety";

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
      .select("name, dose, form, instructions, schedules(time_of_day)")
      .eq("patient_id", patient.id)
      .eq("active", true)
      .order("created_at");
    if (error) throw new Error(error.message);

    const medicines: SafetyMedicine[] = (meds ?? []).map((m) => ({
      name: m.name,
      dose: m.dose,
      form: m.form,
      times: ((m.schedules ?? []) as { time_of_day: string }[]).map((s) => s.time_of_day.slice(0, 5)).sort(),
      instructions: m.instructions,
    }));

    const result: SafetyResult = { findings: [], checkedAt: new Date().toISOString() };
    if (medicines.length < 2) return Response.json(result); // nothing to compare

    try {
      const answer = await generateJSON({
        system: SAFETY_SYSTEM_PROMPT,
        user: safetyUserPrompt(patient.age, medicines, language === "zh" ? "zh" : "en"),
        isValid: isAiSafety,
        maxTokens: 3000,
      });
      result.findings = cleanFindings(answer.findings, medicines.map((m) => m.name));
      return Response.json(result);
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      console.error("safety check: AI unavailable", err.code);
      // The app's own (rule-based) checks still show on the dashboard.
      return Response.json({ error: "ai_unavailable" }, { status: 503 });
    }
  } catch (err) {
    console.error("safety check failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
