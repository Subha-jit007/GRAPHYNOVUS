// Edge-runtime safe Supabase client for middleware ONLY.
// Does NOT import next/headers or server-only — those are Node.js-only and
// would crash in Vercel's Edge middleware sandbox.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getMiddlewareSupabase(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        }
      },
    },
  });
}
