import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Public anon client (browser). Only used for public leaderboard/tag reads.
// All writes go through /api/* with the service-role key (server-only).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  if (!browser) {
    browser = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browser;
}
