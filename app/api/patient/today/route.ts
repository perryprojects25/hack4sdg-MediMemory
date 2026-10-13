// POST /api/patient/today  { id, pin }
// Checks the PIN and returns the patient's first name and today's doses.

import { after } from "next/server";
import { loadPatientDay } from "@/lib/patient-server";
import { sweepPatient } from "@/lib/doses";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { id, pin } = await request.json();
    const day = await loadPatientDay(id, pin);
    if (!day) return Response.json({ error: "wrongPin" }, { status: 401 });

    // After answering, record any unanswered doses as late / missed (doesn't slow the screen).
    after(() => sweepPatient(getSupabaseAdmin(), day.patient.id).catch((err) => console.error("sweep failed", err)));

    return Response.json(day);
  } catch (err) {
    console.error("patient/today failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
