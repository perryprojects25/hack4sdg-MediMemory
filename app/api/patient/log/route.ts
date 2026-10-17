// POST /api/patient/log  { id, pin, medicationId, scheduledFor, action: "taken" | "snooze" | "undo" }
// Records the patient's answer for one dose in intake_logs.

import { loadPatientDay, logDose } from "@/lib/patient-server";

export async function POST(request: Request) {
  try {
    const { id, pin, medicationId, scheduledFor, action } = await request.json();
    const day = await loadPatientDay(id, pin);
    if (!day) return Response.json({ error: "wrongPin" }, { status: 401 });

    const result = await logDose(day.patient.id, day.doses, medicationId, scheduledFor, action);
    return Response.json(result, { status: result.result === "invalid" ? 400 : 200 });
  } catch (err) {
    console.error("patient/log failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
