// POST /api/account/delete  (header: Authorization: Bearer <caregiver token>)
// Deletes the signed-in caregiver's own account. The database then removes their
// caregiver profile and everyone they look after, with all medicines, dose history,
// notes and doctor summaries ("on delete cascade"). This cannot be undone.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEMO_MODE } from "@/lib/demo-mode";

export async function POST(request: Request) {
  // Demo mode: the shared demo account can't be deleted.
  if (DEMO_MODE) return Response.json({ error: "demo_mode" }, { status: 403 });
  try {
    const supabase = getSupabaseAdmin();

    // Only the signed-in person can delete their own account.
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const { data } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    const user = data.user;
    if (!user) return Response.json({ error: "unauthorised" }, { status: 401 });

    // Extra check: the request must repeat the account's email (typed by the caregiver).
    // A guest trying the demo has no email, so "Leave the demo" skips this check.
    const { confirmEmail } = await request.json().catch(() => ({}));
    const emailMatches =
      typeof confirmEmail === "string" && confirmEmail.trim().toLowerCase() === user.email?.toLowerCase();
    if (!user.is_anonymous && !emailMatches) {
      return Response.json({ error: "confirm_mismatch" }, { status: 400 });
    }

    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    return Response.json({ deleted: true });
  } catch (err) {
    console.error("account delete failed", err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
