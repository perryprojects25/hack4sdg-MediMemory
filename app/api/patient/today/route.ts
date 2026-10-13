// POST /api/patient/today  { id, pin }
// Checks the PIN and returns the patient's first name and today's doses.

import { loadPatientDay } from "@/lib/patient-server";

export async function POST(request: Request) {
  try {
    const { id, pin } = await request.json();
    const day = await loadPatientDay(id, pin);
    if (!day) return Response.json({ error: "wrongPin" }, { status: 401 });
    return Response.json(day);
  } catch (err) {
    console.error("patient/today failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
