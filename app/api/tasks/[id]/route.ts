import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  rowToTask,
  type TaskRow,
  type TaskTagJoinRow,
} from "@/lib/tasks";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

async function loadTaskWithTags(
  supabase: ReturnType<typeof getServerSupabase>,
  id: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 as const };
  if (!data) return { error: "not found", status: 404 as const };

  const { data: tagJoin, error: tagErr } = await supabase
    .from("task_tags")
    .select("task_id, tags:tag_id ( id, project_id, name, color )")
    .eq("task_id", id);
  if (tagErr) return { error: tagErr.message, status: 500 as const };

  const tags = ((tagJoin ?? []) as unknown as TaskTagJoinRow[])
    .map((r) => r.tags)
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({
      id: t.id,
      projectId: t.project_id,
      name: t.name,
      color: t.color ?? "#6C63FF",
    }));

  return { task: rowToTask(data as TaskRow, tags) };
}

// GET /api/tasks/[id]
export async function GET(_request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await loadTaskWithTags(supabase, params.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ task: result.task });
}

type PatchBody = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  assigneeId?: unknown;
  estimatedHours?: unknown;
  parentTaskId?: unknown;
  positionX?: unknown;
  positionY?: unknown;
  tagIds?: unknown;
};

// PATCH /api/tasks/[id] — partial update. `tagIds` replaces the task's tag set.
export async function PATCH(request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    patch.title = t;
  }
  if ("description" in body) {
    patch.description = typeof body.description === "string" ? body.description : null;
  }
  if (typeof body.status === "string") {
    if (!(TASK_STATUSES as string[]).includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.priority === "string") {
    if (!(TASK_PRIORITIES as string[]).includes(body.priority)) {
      return NextResponse.json({ error: "invalid priority" }, { status: 400 });
    }
    patch.priority = body.priority;
  }
  if ("dueDate" in body) {
    patch.due_date = typeof body.dueDate === "string" ? body.dueDate : null;
  }
  if ("assigneeId" in body) {
    patch.assignee_id = typeof body.assigneeId === "string" ? body.assigneeId : null;
  }
  if ("estimatedHours" in body) {
    patch.estimated_hours =
      typeof body.estimatedHours === "number" && Number.isFinite(body.estimatedHours)
        ? body.estimatedHours
        : null;
  }
  if ("parentTaskId" in body) {
    patch.parent_task_id = typeof body.parentTaskId === "string" ? body.parentTaskId : null;
  }
  if (typeof body.positionX === "number" && Number.isFinite(body.positionX)) {
    patch.position_x = body.positionX;
  }
  if (typeof body.positionY === "number" && Number.isFinite(body.positionY)) {
    patch.position_y = body.positionY;
  }

  const hasScalarUpdate = Object.keys(patch).length > 0;
  const hasTagUpdate = Array.isArray(body.tagIds);
  if (!hasScalarUpdate && !hasTagUpdate) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  if (hasScalarUpdate) {
    const { error } = await supabase.from("tasks").update(patch).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (hasTagUpdate) {
    const nextIds = (body.tagIds as unknown[]).filter((v): v is string => typeof v === "string");
    const { error: delErr } = await supabase.from("task_tags").delete().eq("task_id", params.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (nextIds.length > 0) {
      const { error: insErr } = await supabase
        .from("task_tags")
        .insert(nextIds.map((tag_id) => ({ task_id: params.id, tag_id })));
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  const result = await loadTaskWithTags(supabase, params.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ task: result.task });
}

// DELETE /api/tasks/[id] — hard delete (task_tags/comments cascade via FK).
export async function DELETE(_request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error, count } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
