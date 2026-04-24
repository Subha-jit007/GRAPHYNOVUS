import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  DEPENDENCY_TYPES,
  rowToDependency,
  type DependencyRow,
} from "@/lib/dependencies";
import type { DependencyType } from "@/types";

export const runtime = "nodejs";

// GET /api/dependencies?projectId=... — list dependencies scoped to a project.
// task_dependencies has no project_id column, so we inner-join through tasks.
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

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId);
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  const ids = (tasks ?? []).map((t) => t.id);
  if (ids.length === 0) return NextResponse.json({ dependencies: [] });

  const { data, error } = await supabase
    .from("task_dependencies")
    .select("id, source_task_id, target_task_id, type")
    .in("source_task_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    dependencies: ((data ?? []) as DependencyRow[]).map(rowToDependency),
  });
}

// POST /api/dependencies — create a dependency edge.
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { sourceTaskId?: unknown; targetTaskId?: unknown; type?: unknown }
    | null;

  const sourceTaskId = typeof body?.sourceTaskId === "string" ? body.sourceTaskId : "";
  const targetTaskId = typeof body?.targetTaskId === "string" ? body.targetTaskId : "";
  if (!sourceTaskId || !targetTaskId) {
    return NextResponse.json(
      { error: "sourceTaskId and targetTaskId are required" },
      { status: 400 },
    );
  }
  if (sourceTaskId === targetTaskId) {
    return NextResponse.json({ error: "cannot depend on self" }, { status: 400 });
  }
  const type: DependencyType =
    typeof body?.type === "string" && (DEPENDENCY_TYPES as string[]).includes(body.type)
      ? (body.type as DependencyType)
      : "blocks";

  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({
      source_task_id: sourceTaskId,
      target_task_id: targetTaskId,
      type,
    })
    .select("id, source_task_id, target_task_id, type")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { dependency: rowToDependency(data as DependencyRow) },
    { status: 201 },
  );
}
