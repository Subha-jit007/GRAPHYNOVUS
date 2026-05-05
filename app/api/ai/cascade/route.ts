import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { rowToTask, type TaskRow } from "@/lib/tasks";
import { rowToDependency, type DependencyRow } from "@/lib/dependencies";
import { computeCascade } from "@/lib/cascade";
import { generateStructured } from "@/lib/gemini";
import type { CascadeImpact, RebalancedTask, Task } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CascadeBody {
  changedTaskId: string;
  newDueDate: string; // YYYY-MM-DD
  projectId: string;
  rebalance?: boolean;
}

// POST /api/ai/cascade — Cascade Impact Analyzer (PRD USP-4, §8.3)
//
// 1. Fetches tasks + "blocks" deps for the project from Supabase.
// 2. Runs a BFS to propagate the due-date delta to all downstream tasks.
// 3. Optionally asks Gemini to suggest optimised dates (rebalance=true).
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CascadeBody;
  try {
    body = (await request.json()) as CascadeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { changedTaskId, newDueDate, projectId, rebalance } = body ?? {};
  if (!changedTaskId || !newDueDate || !projectId) {
    return NextResponse.json(
      { error: "changedTaskId, newDueDate, and projectId are required" },
      { status: 400 },
    );
  }

  // --- Fetch project tasks -------------------------------------------------
  const { data: taskRows, error: taskErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  const tasks: Task[] = (taskRows ?? []).map((r) => rowToTask(r as TaskRow));
  if (tasks.length === 0) {
    return NextResponse.json(emptyImpact());
  }

  // --- Fetch dependencies for these tasks ----------------------------------
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

  // --- BFS cascade computation ---------------------------------------------
  const impact = computeCascade({ changedTaskId, newDueDate, tasks, dependencies });

  if (!rebalance || impact.affected.length === 0) {
    return NextResponse.json(impact);
  }

  // --- Gemini rebalance (optional) -----------------------------------------
  try {
    const { narrative, tasks: rebalancedTasks } = await askGeminiRebalance({
      changedTaskId,
      newDueDate,
      tasks,
      impact,
    });
    return NextResponse.json({
      ...impact,
      rebalanceSuggestion: narrative,
      rebalancedTasks,
    } satisfies CascadeImpact);
  } catch (err) {
    // Rebalance is best-effort; return plain impact on Gemini failure.
    console.error("[cascade] Gemini rebalance failed:", err);
    return NextResponse.json(impact);
  }
}

// ---------------------------------------------------------------------------
// Gemini rebalance helper
// ---------------------------------------------------------------------------

interface RebalanceResult {
  narrative: string;
  tasks: RebalancedTask[];
}

interface GeminiRebalanceRaw {
  narrative?: string;
  tasks?: Array<{
    taskId?: string;
    suggestedDueDate?: string;
    reason?: string;
  }>;
}

async function askGeminiRebalance(opts: {
  changedTaskId: string;
  newDueDate: string;
  tasks: Task[];
  impact: CascadeImpact;
}): Promise<RebalanceResult> {
  const { changedTaskId, newDueDate, tasks, impact } = opts;

  const changedTask = tasks.find((t) => t.id === changedTaskId);
  const affectedSummary = impact.affected.map(({ taskId, delayDays }) => {
    const t = tasks.find((x) => x.id === taskId);
    return {
      id: taskId,
      title: t?.title ?? taskId,
      currentDueDate: t?.dueDate?.slice(0, 10) ?? null,
      propagatedDelayDays: delayDays,
    };
  });

  const allTasksSummary = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueDate: t.dueDate?.slice(0, 10) ?? null,
  }));

  const prompt = `You are a project scheduling optimizer for Graphynovus.

## Change being made
Task: "${changedTask?.title ?? changedTaskId}"
Original due date: ${changedTask?.dueDate?.slice(0, 10) ?? "unset"}
New due date: ${newDueDate}

## Affected tasks (naively shifted by the same delta)
${JSON.stringify(affectedSummary, null, 2)}

## All project tasks (for context)
${JSON.stringify(allTasksSummary, null, 2)}

## Your job
Suggest optimised due dates for the affected tasks that:
1. Respect dependency ordering (a blocker cannot be due after the task it blocks)
2. Distribute delay intelligently — absorb slack where it exists
3. Minimise the push to the final project deadline
4. Do not move any task before today (${new Date().toISOString().slice(0, 10)}) unless it is already past due

Only include tasks that should change (not every task). Keep the list tight.

## Output format (strict JSON, no prose outside it)
{
  "narrative": "1-2 sentence plain-English summary of your rebalancing strategy",
  "tasks": [
    { "taskId": "<uuid>", "suggestedDueDate": "YYYY-MM-DD", "reason": "one sentence" }
  ]
}`;

  const raw = await generateStructured<GeminiRebalanceRaw>(prompt, {
    temperature: 0.25,
    maxOutputTokens: 2048,
  });

  return {
    narrative: typeof raw.narrative === "string" ? raw.narrative : "",
    tasks: (raw.tasks ?? [])
      .filter(
        (t): t is RebalancedTask =>
          typeof t.taskId === "string" &&
          typeof t.suggestedDueDate === "string" &&
          typeof t.reason === "string",
      )
      .map((t) => ({
        taskId: t.taskId,
        suggestedDueDate: t.suggestedDueDate,
        reason: t.reason,
      })),
  };
}

function emptyImpact(): CascadeImpact {
  return {
    affected: [],
    totalDelayDays: 0,
    finalDateShift: null,
    rebalanceSuggestion: null,
    rebalancedTasks: null,
  };
}
