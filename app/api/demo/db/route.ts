// POST /api/demo/db  { table, calls }
// HACKATHON DEMO MODE only: runs one database request from the browser with the
// service role key, limited to the demo caregiver's data (lib/demo-server.ts).

import { DEMO_MODE } from "@/lib/demo-mode";
import { ensureDemoCaregiver, isRefused, runDemoQuery } from "@/lib/demo-server";

export async function POST(request: Request) {
  if (!DEMO_MODE) return Response.json({ error: "not found" }, { status: 404 });
  try {
    const { table, calls } = await request.json();
    await ensureDemoCaregiver();
    const { data, error, count } = await runDemoQuery(table, calls);
    return Response.json({ data: data ?? null, error: error ?? null, count: count ?? null });
  } catch (err) {
    if (isRefused(err)) {
      return Response.json({ data: null, error: { message: (err as Error).message } }, { status: 403 });
    }
    console.error("demo/db failed", err);
    return Response.json({ data: null, error: { message: "server error" } }, { status: 500 });
  }
}
