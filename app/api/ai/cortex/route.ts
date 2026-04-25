import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/gemini";
import { getServerSupabase } from "@/lib/supabase";
import {
  aggregatePatterns,
  formatMemoryForPrompt,
  type CompletionRow,
} from "@/lib/memory";
import type {
  CortexMode,
  CortexRequest,
  CortexResponse,
  TaskPriority,
  TaskStatus,
} from "@/types";

export const runtime = "nodejs";

// POST /api/ai/cortex — AI Execution Cortex (PRD USP-2, §8.1)
//
// Takes a natural-language goal + mode, asks Gemini to break it into a
// structured plan, and returns tasks + dependency edges referenced by
// temporary task IDs ("t1", "t2", ...). The client is responsible for
// turning the plan into real rows when the user accepts it.
//
// When the authenticated user has enough behavioral history in ai_memory,
// their patterns (typical delays, velocity per category) are injected into
// the Gemini system prompt so estimates are personalised.
export async function POST(request: Request) {
  let body: CortexRequest;
  try {
    body = (await request.json()) as CortexRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const prompt = body?.prompt?.trim();
  const mode: CortexMode = body?.mode ?? "generate";
  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 },
    );
  }

  // --- Behavioral memory injection (best-effort; never fails the request) ---
  let memoryContext = "";
  try {
    const supabase = getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("ai_memory")
        .select("pattern_data_json")
        .eq("user_id", user.id)
        .eq("pattern_type", "task_completion")
        .order("updated_at", { ascending: false })
        .limit(500);

      if (data?.length) {
        const rows = data.map((r) => r.pattern_data_json as CompletionRow);
        const patterns = aggregatePatterns(rows);
        memoryContext = formatMemoryForPrompt(patterns);
      }
    }
  } catch {
    // Memory failure is non-fatal — Cortex continues without personalisation.
  }

  const memoryUsed = memoryContext.length > 0;

  try {
    const raw = await generateStructured<RawCortex>(
      buildUserPrompt(prompt, mode, body.projectId),
      {
        systemInstruction: buildSystemInstruction(memoryContext),
        temperature: 0.5,
        maxOutputTokens: 4096,
      },
    );
    return NextResponse.json({ ...normalize(raw), memoryUsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cortex failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// System instruction
// ---------------------------------------------------------------------------

const BASE_INSTRUCTION = `You are Graphynovus Cortex, the planning brain of an AI-native project board.
You break real-world goals into a dependency-aware execution plan.

Rules:
- Output STRICT JSON. No prose, no markdown, no comments.
- Generate 5-14 tasks. Each task must be concrete and individually executable.
- Assign every task a temporary id like "t1", "t2", ... (1-indexed, unique).
- Dependencies use those same ids via sourceTaskId -> targetTaskId where
  sourceTaskId BLOCKS targetTaskId (i.e. source must finish before target).
- Task statuses must be one of: backlog, todo, in_progress, blocked, review, done.
  For freshly-generated plans, use "todo" for the first few tasks and "backlog" for later ones.
- Priorities must be one of: low, medium, high, urgent.
- estimatedHours should be a realistic number (0.5 - 40).
- Timeline dates are ISO 8601 (YYYY-MM-DD).
- criticalPath is an ordered list of task ids forming the longest blocker chain.
- missingSteps lists 0-4 steps the user likely forgot; phrase each as an imperative sentence.
- weekOnePlan is a short markdown checklist (3-6 bullets, "- [ ] ...") of what to do in the first week.`;

function buildSystemInstruction(memoryContext: string): string {
  if (!memoryContext) return BASE_INSTRUCTION;
  return `${BASE_INSTRUCTION}\n\n${memoryContext}`;
}

// ---------------------------------------------------------------------------
// User prompt
// ---------------------------------------------------------------------------

function buildUserPrompt(
  prompt: string,
  mode: CortexMode,
  projectId: string | undefined,
): string {
  const header = MODE_HEADERS[mode] ?? MODE_HEADERS.generate;
  const projectLine = projectId
    ? `\nProject context id: ${projectId}. Assume prior tasks exist; generated tasks should complement, not duplicate, common prior work.`
    : "";

  return [
    header,
    projectLine,
    `\nUser goal:\n"""${prompt}"""`,
    `\nReturn a JSON object with this exact shape:`,
    `{
  "tasks": [
    {
      "tempId": "t1",
      "title": "string",
      "description": "string",
      "status": "backlog|todo|in_progress|blocked|review|done",
      "priority": "low|medium|high|urgent",
      "estimatedHours": number,
      "dueDate": "YYYY-MM-DD or null"
    }
  ],
  "dependencies": [
    { "sourceTaskId": "t1", "targetTaskId": "t2", "type": "blocks" }
  ],
  "timeline": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
  "criticalPath": ["t1", "t3", "t7"],
  "missingSteps": ["string", "string"],
  "weekOnePlan": "- [ ] step one\\n- [ ] step two"
}`,
  ].join("\n");
}

const MODE_HEADERS: Record<CortexMode, string> = {
  generate:
    "Mode: GENERATE. Decompose the goal into a fresh end-to-end execution plan.",
  expand:
    "Mode: EXPAND. The user is asking you to flesh out a sparse or ambiguous goal into detailed subtasks.",
  fix:
    "Mode: FIX. The user's project is stuck. Generate tasks that unblock momentum and resolve the most likely blockers.",
  standup:
    "Mode: STANDUP. Summarize today's focus as 3-5 actionable tasks for the next working day.",
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

interface RawTask {
  tempId?: string;
  id?: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  estimatedHours?: number | string | null;
  dueDate?: string | null;
}

interface RawDep {
  sourceTaskId?: string;
  targetTaskId?: string;
  type?: string;
}

interface RawCortex {
  tasks?: RawTask[];
  dependencies?: RawDep[];
  timeline?: { startDate?: string | null; endDate?: string | null };
  criticalPath?: string[];
  missingSteps?: string[];
  weekOnePlan?: string;
}

const VALID_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
];
const VALID_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

function normalize(raw: RawCortex): Omit<CortexResponse, "memoryUsed"> {
  const tasks = (raw.tasks ?? []).map((t, i) => {
    const tempId = t.tempId ?? t.id ?? `t${i + 1}`;
    const status = (VALID_STATUSES as string[]).includes(t.status ?? "")
      ? (t.status as TaskStatus)
      : ("todo" as TaskStatus);
    const priority = (VALID_PRIORITIES as string[]).includes(t.priority ?? "")
      ? (t.priority as TaskPriority)
      : ("medium" as TaskPriority);
    const hoursNum =
      typeof t.estimatedHours === "string"
        ? Number.parseFloat(t.estimatedHours)
        : t.estimatedHours ?? null;
    return {
      id: tempId,
      title: (t.title ?? "Untitled task").trim(),
      description: t.description ?? null,
      status,
      priority,
      estimatedHours: Number.isFinite(hoursNum) ? (hoursNum as number) : null,
      dueDate: t.dueDate ?? null,
    };
  });

  const taskIds = new Set(tasks.map((t) => t.id));
  const dependencies = (raw.dependencies ?? [])
    .filter(
      (d) =>
        d.sourceTaskId &&
        d.targetTaskId &&
        d.sourceTaskId !== d.targetTaskId &&
        taskIds.has(d.sourceTaskId) &&
        taskIds.has(d.targetTaskId),
    )
    .map((d) => ({
      sourceTaskId: d.sourceTaskId!,
      targetTaskId: d.targetTaskId!,
      type: (d.type === "related" || d.type === "subtask"
        ? d.type
        : "blocks") as "blocks" | "related" | "subtask",
    }));

  return {
    tasks,
    dependencies,
    timeline: {
      startDate: raw.timeline?.startDate ?? null,
      endDate: raw.timeline?.endDate ?? null,
    },
    criticalPath: (raw.criticalPath ?? []).filter((id) => taskIds.has(id)),
    missingSteps: (raw.missingSteps ?? []).filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    ),
    weekOnePlan: raw.weekOnePlan ?? "",
  };
}
