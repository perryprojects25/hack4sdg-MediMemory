// GET /api/cron/sweep
// Scheduled job (Vercel Cron, see vercel.json): marks unanswered doses as late / missed
// for every patient, so records stay accurate even if nobody opens the app.
// The same check also runs whenever the patient screen or caregiver dashboard loads.

import { sweepPatient } from "@/lib/doses";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: patients, error } = await supabase.from("patients").select("id");
  if (error) return Response.json({ error: "server" }, { status: 500 });

  let added = 0;
  for (const patient of patients ?? []) {
    try {
      added += await sweepPatient(supabase, patient.id);
    } catch (err) {
      console.error("sweep failed for a patient", err);
    }
  }
  return Response.json({ patients: patients?.length ?? 0, rowsAdded: added });
}
