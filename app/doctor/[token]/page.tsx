import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SummaryContent } from "@/lib/summary";
import DoctorView from "./DoctorView";

// Read-only doctor summary, opened via the random link the caregiver shared.
// The token is 64 random characters; a revoked link (token set to null) stops working.
export default async function DoctorPage(props: PageProps<"/doctor/[token]">) {
  const { token } = await props.params;

  let content: SummaryContent | null = null;
  if (/^[0-9a-f]{64}$/.test(token)) {
    try {
      const { data } = await getSupabaseAdmin()
        .from("summaries")
        .select("content_json")
        .eq("share_token", token)
        .maybeSingle();
      content = (data?.content_json as SummaryContent | undefined) ?? null;
    } catch (err) {
      console.error("doctor page failed", err);
    }
  }

  return <DoctorView content={content} />;
}
