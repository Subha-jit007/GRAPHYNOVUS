import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Supabase redirects users back here with `?code=...` after Google OAuth or
// after they click the email magic link. We exchange that code for a session
// (stored as cookies) and then forward them to the requested page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failure = new URL("/login", url.origin);
      failure.searchParams.set("error", error.message);
      return NextResponse.redirect(failure);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
