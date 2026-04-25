import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToComment, type CommentRow } from "@/lib/comments";

export const runtime = "nodejs";

// GET /api/comments?taskId=... — list comments for a task, newest last.
// Joins users table for display name; RLS on both tables is enforced by the
// anon-key client (users_select_self policy means the join returns user data
// only for the authenticated user's own rows — fine for single-user MVP).
export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("comments")
    .select("*, users:user_id ( name, email )")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    comments: ((data ?? []) as unknown as CommentRow[]).map(rowToComment),
  });
}

// POST /api/comments — add a comment to a task.
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { taskId?: unknown; content?: unknown }
    | null;

  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
  const content =
    typeof body?.content === "string" ? body.content.trim() : "";
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, user_id: user.id, content })
    .select("*, users:user_id ( name, email )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { comment: rowToComment(data as unknown as CommentRow) },
    { status: 201 },
  );
}
