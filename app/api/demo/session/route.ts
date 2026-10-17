// GET /api/demo/session
// HACKATHON DEMO MODE only: returns the fixed demo caregiver, as if they had signed in.

import { DEMO_MODE } from "@/lib/demo-mode";
import { ensureDemoCaregiver } from "@/lib/demo-server";

export async function GET() {
  if (!DEMO_MODE) return Response.json({ error: "not found" }, { status: 404 });
  try {
    return Response.json({ caregiver: await ensureDemoCaregiver() });
  } catch (err) {
    console.error("demo/session failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
