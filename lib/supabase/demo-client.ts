// HACKATHON DEMO MODE: a stand-in for the Supabase browser client.
// It understands the same chained calls the app already uses, for example
//   supabase.from("patients").select("*").eq("caregiver_id", id).order("created_at")
// but instead of talking to Supabase directly, it sends the list of calls to
// POST /api/demo/db, which runs them on the server for the demo caregiver.
// Sign-in (supabase.auth) is switched off: any use of it is a bug, so it throws.

import type { SupabaseClient } from "@supabase/supabase-js";

type Call = { method: string; args: unknown[] };
type Result = { data: unknown; error: { message: string; code?: string } | null; count: number | null };

async function run(table: string, calls: Call[]): Promise<Result> {
  try {
    const response = await fetch("/api/demo/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, calls }),
    });
    return await response.json();
  } catch {
    return { data: null, error: { message: "Network error" }, count: null };
  }
}

// Each chained call is recorded; awaiting the chain sends it.
function query(table: string, calls: Call[]): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
            run(table, calls).then(resolve, reject);
        }
        if (typeof prop !== "string") return undefined;
        return (...args: unknown[]) => query(table, [...calls, { method: prop, args }]);
      },
    }
  );
}

const authDisabled = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(`Sign-in is disabled in demo mode (supabase.auth.${String(prop)})`);
    },
  }
);

export function createDemoClient(): SupabaseClient {
  return { from: (table: string) => query(table, []), auth: authDisabled } as unknown as SupabaseClient;
}
