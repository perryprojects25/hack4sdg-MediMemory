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
  // Tidy up: delete demo guest accounts older than a day (their demo data goes with them).
  let guestsRemoved = 0;
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const user of users?.users ?? []) {
    const ageHours = (Date.now() - new Date(user.created_at).getTime()) / 3_600_000;
    if (user.is_anonymous && ageHours > 24) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (!deleteError) guestsRemoved++;
    }
  }

  return Response.json({ patients: patients?.length ?? 0, rowsAdded: added, guestsRemoved });
}
