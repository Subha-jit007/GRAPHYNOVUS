import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToTag, type TagRow } from "@/lib/tags";

export const runtime = "nodejs";

// GET /api/tags?projectId=... — list a project's tags.
export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tags")
    .select("id, project_id, name, color")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: ((data ?? []) as TagRow[]).map(rowToTag) });
}

// POST /api/tags — create a tag for a project.
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { projectId?: unknown; name?: unknown; color?: unknown }
    | null;

  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("tags")
    .insert({
      project_id: projectId,
      name,
      color: typeof body?.color === "string" ? body.color : null,
    })
    .select("id, project_id, name, color")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tag: rowToTag(data as TagRow) }, { status: 201 });
}
