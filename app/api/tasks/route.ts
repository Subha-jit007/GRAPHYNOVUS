import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  groupTagsByTask,
  rowToTask,
  type TaskRow,
  type TaskTagJoinRow,
} from "@/lib/tasks";
import type { TaskPriority, TaskStatus } from "@/types";

export const runtime = "nodejs";

// GET /api/tasks?projectId=... — list project tasks with tags attached.
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

  const { data: taskRows, error: taskErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  const rows = (taskRows ?? []) as TaskRow[];
  if (rows.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  const { data: tagJoin, error: tagErr } = await supabase
    .from("task_tags")
    .select("task_id, tags:tag_id ( id, project_id, name, color )")
    .in(
      "task_id",
      rows.map((r) => r.id),
    );

  if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 });

  const tagsByTask = groupTagsByTask((tagJoin ?? []) as unknown as TaskTagJoinRow[]);
  const tasks = rows.map((r) => rowToTask(r, tagsByTask[r.id] ?? []));
  return NextResponse.json({ tasks });
}

type CreateBody = {
  projectId?: unknown;
  parentTaskId?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  assigneeId?: unknown;
  estimatedHours?: unknown;
  tagIds?: unknown;
};

// POST /api/tasks — create a task. Optionally attaches tagIds.
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const status =
    typeof body?.status === "string" && (TASK_STATUSES as string[]).includes(body.status)
      ? (body.status as TaskStatus)
      : "backlog";
  const priority =
    typeof body?.priority === "string" && (TASK_PRIORITIES as string[]).includes(body.priority)
      ? (body.priority as TaskPriority)
      : "medium";

  const insert: Record<string, unknown> = {
    project_id: projectId,
    title,
    status,
    priority,
    description: typeof body?.description === "string" ? body.description : null,
    due_date: typeof body?.dueDate === "string" ? body.dueDate : null,
    assignee_id: typeof body?.assigneeId === "string" ? body.assigneeId : null,
    estimated_hours:
      typeof body?.estimatedHours === "number" && Number.isFinite(body.estimatedHours)
        ? body.estimatedHours
        : null,
    parent_task_id: typeof body?.parentTaskId === "string" ? body.parentTaskId : null,
  };

  const { data: created, error } = await supabase
    .from("tasks")
    .insert(insert)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tagIds = Array.isArray(body?.tagIds) ? body!.tagIds.filter((v) => typeof v === "string") : [];
  let tags: Awaited<ReturnType<typeof rowToTask>>["tags"] = [];
  if (tagIds.length > 0) {
    const { error: linkErr } = await supabase
      .from("task_tags")
      .insert(tagIds.map((tag_id) => ({ task_id: created.id, tag_id })));
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

    const { data: tagRows } = await supabase
      .from("tags")
      .select("id, project_id, name, color")
      .in("id", tagIds as string[]);
    tags = (tagRows ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      color: r.color ?? "#6C63FF",
    }));
  }

  return NextResponse.json({ task: rowToTask(created as TaskRow, tags) }, { status: 201 });
}
