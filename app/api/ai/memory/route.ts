import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  aggregatePatterns,
  inferCategory,
  type CompletionRow,
} from "@/lib/memory";

export const runtime = "nodejs";

const MS_PER_DAY = 86_400_000;

// GET /api/ai/memory — Aggregated behavioral patterns for the current user.
// Used by the Cortex route to personalise task estimates.
export async function GET() {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ai_memory")
    .select("pattern_data_json")
    .eq("user_id", user.id)
    .eq("pattern_type", "task_completion")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => r.pattern_data_json as CompletionRow);
  return NextResponse.json({ patterns: aggregatePatterns(rows) });
}

// POST /api/ai/memory — Record a task-completion event.
// Called fire-and-forget from the client whenever a task reaches "done".
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    taskTitle?: string;
    tags?: string[];
    timeTakenDays?: number;
    wasDelayed?: boolean;
    delayDays?: number;
    dueDate?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    taskTitle = "",
    tags = [],
    timeTakenDays = 0,
    wasDelayed = false,
    delayDays: clientDelayDays,
    dueDate,
  } = body;

  const category = inferCategory(taskTitle, tags);

  // Resolve delay in days (client may have already computed it)
  let delayDays = clientDelayDays ?? 0;
  if (wasDelayed && !clientDelayDays && dueDate) {
    delayDays = Math.max(
      0,
      Math.ceil((Date.now() - new Date(dueDate).getTime()) / MS_PER_DAY),
    );
  }

  const patternData: CompletionRow & { title: string; tags: string[] } = {
    category,
    timeTakenDays: Math.max(0, Math.round(timeTakenDays)),
    wasDelayed,
    delayDays,
    title: taskTitle,
    tags,
  };

  // Confidence grows with evidence: longer tasks produce stronger signal.
  const confidence = Math.min(
    0.95,
    0.3 + patternData.timeTakenDays * 0.01,
  );

  const { error } = await supabase.from("ai_memory").insert({
    user_id: user.id,
    pattern_type: "task_completion",
    pattern_data_json: patternData,
    confidence_score: confidence,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, category });
}
