"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";

export async function signOutAction() {
  const supabase = getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
