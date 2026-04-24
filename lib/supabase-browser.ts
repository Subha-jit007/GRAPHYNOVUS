import { createBrowserClient } from "@supabase/ssr";

// Browser-only Supabase client. Kept in its own module so client components
// don't pull in `next/headers` (which is server-only) transitively.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
