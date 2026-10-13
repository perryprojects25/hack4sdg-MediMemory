// POST /api/patient/login  { username, pin }
// Sign in on the patient screen without a personal link.
// Returns the patient id; the device then remembers id + PIN like the link does.

import { findPatientByLogin } from "@/lib/patient-server";

export async function POST(request: Request) {
  try {
    const { username, pin } = await request.json();
    const id = await findPatientByLogin(username, pin);
    if (!id) return Response.json({ error: "wrongLogin" }, { status: 401 });
    return Response.json({ id });
  } catch (err) {
    console.error("patient/login failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
