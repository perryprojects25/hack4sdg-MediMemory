// POST /api/summary  { patientId, start, end, language }  (header: Authorization: Bearer <caregiver token>)
// Builds the doctor summary: facts computed in code, then written up by the AI.
// The caregiver reviews the result before creating a doctor link (human in the loop).

import { AiError, generateJSON } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { LOG_COLUMNS, MED_COLUMNS, addDays, dayStartISO, type LogForDoses, type MedForDoses } from "@/lib/doses";
import { SYSTEM_PROMPT, computeFacts, isAiSummary, userPrompt } from "@/lib/summary";

export const maxDuration = 60; // seconds; the AI call can take a while

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Who is asking? Only a signed-in caregiver, for their own patient.
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    if (!auth.user) return Response.json({ error: "unauthorised" }, { status: 401 });

    const { patientId, start, end, language } = await request.json();
    if (typeof start !== "string" || typeof end !== "string" || !DATE.test(start) || !DATE.test(end) || start > end) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("id, caregiver_id, name, age")
      .eq("id", patientId)
      .maybeSingle();
    if (!patient || patient.caregiver_id !== auth.user.id) {
      return Response.json({ error: "unauthorised" }, { status: 401 });
    }

    // 2. Load the data for the period.
    const [medsResult, logsResult, notesResult] = await Promise.all([
      supabase.from("medications").select(MED_COLUMNS).eq("patient_id", patient.id),
      supabase
        .from("intake_logs")
        .select(LOG_COLUMNS)
        .eq("patient_id", patient.id)
        .gte("scheduled_for", dayStartISO(start))
        .lt("scheduled_for", dayStartISO(addDays(end, 1))),
      supabase.from("caregiver_notes").select("note, created_at").eq("patient_id", patient.id),
    ]);
    if (medsResult.error || logsResult.error || notesResult.error) throw new Error("database read failed");

    // 3. Compute the facts in code.
    const { facts, medications, rawLog } = computeFacts({
      meds: medsResult.data as MedForDoses[],
      logs: logsResult.data as LogForDoses[],
      notes: notesResult.data ?? [],
      start,
      end,
    });

    // 4. Ask the AI to write them up (de-identified: no names, no IDs).
    const summary = await generateJSON({
      system: SYSTEM_PROMPT,
      user: userPrompt(facts, language === "zh" ? "zh" : "en"),
      isValid: isAiSummary,
      maxTokens: 4000,
      temperature: 0.2,
    });

    return Response.json({
      patient: { name: patient.name, age: patient.age }, // shown to the doctor, never sent to the AI
      period: { start, end },
      language: language === "zh" ? "zh" : "en",
      summary,
      facts,
      medications,
      rawLog,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AiError) {
      console.error("summary AI error:", err.code, err.message);
      const error =
        err.code === "not_configured"
          ? "ai_not_configured"
          : err.code === "no_credit"
            ? "ai_no_credit"
            : err.code === "bad_key"
              ? "ai_bad_key"
              : "ai_failed";
      return Response.json({ error }, { status: 502 });
    }
    console.error("summary failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
