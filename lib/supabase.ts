import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Uses the anon key (safe to expose) and relies
 * on RLS policies (see supabase/schema.sql) to scope every query to the
 * signed-in user.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
