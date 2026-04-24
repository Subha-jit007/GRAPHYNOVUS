import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToTask, type TaskRow } from "@/lib/tasks";
import { computeEntropy, entropyReasons } from "@/lib/entropy";
import type { DependencyType, TaskDependency } from "@/types";

export const runtime = "nodejs";

interface DepRow {
  id: string;
  source_task_id: string;
  target_task_id: string;
  type: DependencyType;
}

// GET /api/ai/entropy?projectId=... — Project Entropy Score (PRD USP-3, §8.2).
// Server-authoritative score calculation. The Graph/Kanban views recompute
// the same value client-side via useEntropy; this endpoint is the source of
// truth for dashboards and background sync jobs.
export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }

  const { data: taskRows, error: tErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const tasks = ((taskRows ?? []) as TaskRow[]).map((r) => rowToTask(r));
  const taskIds = tasks.map((t) => t.id);

  let deps: TaskDependency[] = [];
  if (taskIds.length > 0) {
    const { data: depRows, error: dErr } = await supabase
      .from("task_dependencies")
      .select("id, source_task_id, target_task_id, type")
      .in("source_task_id", taskIds);
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });
    deps = ((depRows ?? []) as DepRow[]).map((d) => ({
      id: d.id,
      sourceTaskId: d.source_task_id,
      targetTaskId: d.target_task_id,
      type: d.type,
    }));
  }

  const { score, level, breakdown } = computeEntropy(tasks, deps);
  const report = entropyReasons(breakdown);

  // Persist the latest score so the dashboard card stays in sync without
  // loading per-project task data. Best-effort: a failure here doesn't
  // block the response.
  void supabase
    .from("projects")
    .update({ entropy_score: score })
    .eq("id", projectId)
    .then(() => {});

  return NextResponse.json({
    projectId,
    score,
    level,
    breakdown,
    report,
  });
}
