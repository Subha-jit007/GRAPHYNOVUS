import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToProject } from "@/lib/projects";
import { rowToTask, type TaskRow } from "@/lib/tasks";
import { rowToDependency, type DependencyRow } from "@/lib/dependencies";
import { scoreTasks, type FocusItem, REASON_LABELS } from "@/lib/focus";
import { generateStructured } from "@/lib/gemini";

export const runtime = "nodejs";

// GET /api/ai/focus — Score-ranked focus task list for Today's Focus widget.
//
// Fetches every non-done task across all active projects for the user,
// runs the multi-signal scoring algorithm (due urgency, blocker weight,
// staleness, priority), and returns the top 5.
export async function GET() {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // All active projects for this user
  const { data: projectRows, error: projectErr } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (projectErr) {
    return NextResponse.json({ error: projectErr.message }, { status: 500 });
  }

  const projects = (projectRows ?? []).map(rowToProject);
  if (projects.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const projectIds = projects.map((p) => p.id);

  // All non-done tasks across those projects
  const { data: taskRows, error: taskErr } = await supabase
    .from("tasks")
    .select("*")
    .in("project_id", projectIds)
    .neq("status", "done")
    .order("created_at", { ascending: true });

  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  const tasks = (taskRows ?? []).map((r) => rowToTask(r as TaskRow));
  if (tasks.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Dependencies — only need outgoing "blocks" edges to compute blocker weight
  const taskIds = tasks.map((t) => t.id);
  const { data: depRows, error: depErr } = await supabase
    .from("task_dependencies")
    .select("*")
    .in("source_task_id", taskIds);

  if (depErr) {
    return NextResponse.json({ error: depErr.message }, { status: 500 });
  }

  const dependencies = (depRows ?? []).map((r) =>
    rowToDependency(r as DependencyRow),
  );

  const items = scoreTasks({ tasks, projects, dependencies });
  return NextResponse.json({ items });
}

// POST /api/ai/focus — Given the already-scored focus list, ask Gemini why
// these tasks were chosen. Called lazily when the user expands "Why these?".
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { items: FocusItem[] };
  try {
    body = (await request.json()) as { items: FocusItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { items } = body ?? {};
  if (!items?.length) {
    return NextResponse.json({ explanation: "" });
  }

  const taskLines = items
    .map((item, i) => {
      const due = item.task.dueDate
        ? `due ${new Date(item.task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : "no due date";
      const reasonText = item.reasons
        .map((r) => REASON_LABELS[r] ?? r)
        .join(", ");
      return `${i + 1}. "${item.task.title}" (${item.project.title}) — ${due}; signals: ${reasonText}`;
    })
    .join("\n");

  const prompt = `You are the Graphynovus AI assistant. A user's "Today's Focus" widget shows these tasks ranked by urgency score:

${taskLines}

Write a concise explanation (2-3 sentences, plain English, warm and direct tone) of why these specific tasks are the most important to work on today. Reference task names. Call out overdue tasks or blockers specifically. Keep it under 70 words.

Return JSON: { "explanation": "your 2-3 sentence explanation here" }`;

  try {
    const raw = await generateStructured<{ explanation?: string }>(prompt, {
      temperature: 0.55,
      maxOutputTokens: 256,
    });
    return NextResponse.json({
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    });
  } catch {
    return NextResponse.json({ explanation: "" });
  }
}
