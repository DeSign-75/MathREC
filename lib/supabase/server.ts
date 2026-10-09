import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client (SERVER ONLY). Bypasses RLS — never import client-side.
// Callers must verify the Clerk session first.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  if (!admin) {
    admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return admin;
}
