import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToProject } from "@/lib/projects";

export const runtime = "nodejs";

// GET /api/projects — list current user's projects (RLS-scoped).
export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeArchived) query = query.eq("status", "active");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ projects: (data ?? []).map(rowToProject) });
}

// POST /api/projects — create a new project.
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { title?: unknown; description?: unknown; color?: unknown; icon?: unknown }
    | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title,
      description: typeof body?.description === "string" ? body.description : null,
      color: typeof body?.color === "string" ? body.color : null,
      icon: typeof body?.icon === "string" ? body.icon : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: rowToProject(data) }, { status: 201 });
}
