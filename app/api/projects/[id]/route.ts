import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToProject } from "@/lib/projects";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

// GET /api/projects/[id]
export async function GET(_request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ project: rowToProject(data) });
}

// PATCH /api/projects/[id] — update title/description/color/icon.
export async function PATCH(request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        title?: unknown;
        description?: unknown;
        color?: unknown;
        icon?: unknown;
      }
    | null;

  const patch: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    patch.title = t;
  }
  if (body && "description" in body) {
    patch.description = typeof body.description === "string" ? body.description : null;
  }
  if (body && "color" in body) {
    patch.color = typeof body.color === "string" ? body.color : null;
  }
  if (body && "icon" in body) {
    patch.icon = typeof body.icon === "string" ? body.icon : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ project: rowToProject(data) });
}

// DELETE /api/projects/[id] — soft archive (status='archived', archived_at=now()).
export async function DELETE(_request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ project: rowToProject(data) });
}
