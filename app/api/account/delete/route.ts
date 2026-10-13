// POST /api/account/delete  (header: Authorization: Bearer <caregiver token>)
// Deletes the signed-in caregiver's own account. The database then removes their
// caregiver profile and everyone they look after, with all medicines, dose history,
// notes and doctor summaries ("on delete cascade"). This cannot be undone.

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    // Only the signed-in person can delete their own account.
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const { data } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    const user = data.user;
    if (!user) return Response.json({ error: "unauthorised" }, { status: 401 });

    // Extra check: the request must repeat the account's email (typed by the caregiver).
    const { confirmEmail } = await request.json();
    if (typeof confirmEmail !== "string" || confirmEmail.trim().toLowerCase() !== user.email?.toLowerCase()) {
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
