// Supabase client for use in the BROWSER (client components).
// Uses the public "anon" key, so Row Level Security decides what each user can see.
// In HACKATHON DEMO MODE (lib/demo-mode.ts) it returns a stand-in that sends every
// request to the server instead, because nobody is signed in.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_MODE } from "@/lib/demo-mode";
import { createDemoClient } from "./demo-client";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;

  if (DEMO_MODE) {
    browserClient = createDemoClient();
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
