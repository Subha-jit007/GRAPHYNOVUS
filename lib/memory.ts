// Execution Memory shared logic (PRD USP-6).
// This module is intentionally free of server-only imports so it can run
// on both the server (imported by API routes) and the client (called from
// the store / components to fire fire-and-forget completion events).

import type { Task } from "@/types";

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Category inference
// ---------------------------------------------------------------------------

// Maps task title + tag names to a coarse work category via keyword matching.
// Order matters: first match wins.
const CATEGORY_PATTERNS: Array<{ category: string; re: RegExp }> = [
  { category: "design", re: /design|ui|ux|figma|wireframe|mockup|prototype|visual|brand|style|layout/i },
  { category: "development", re: /dev|code|implement|build|api|backend|frontend|fix|bug|refactor|feature|function|component|integrate|endpoint/i },
  { category: "testing", re: /test|qa|review|check|verify|validate|audit|assert|coverage/i },
  { category: "content", re: /write|content|copy|doc|documentation|readme|blog|post|article|description|script/i },
  { category: "research", re: /research|investigate|analyze|explore|study|survey|interview|discovery/i },
  { category: "meetings", re: /meeting|call|discuss|sync|standup|demo|presentation|kickoff/i },
  { category: "deployment", re: /deploy|ship|release|launch|publish|production|ci|cd|pipeline|infra/i },
  { category: "planning", re: /plan|strategy|roadmap|spec|requirement|scope|estimate|backlog|groom/i },
];

export function inferCategory(title: string, tags: string[]): string {
  const text = [title, ...tags].join(" ");
  for (const { category, re } of CATEGORY_PATTERNS) {
    if (re.test(text)) return category;
  }
  return "general";
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface CompletionRow {
  category: string;
  timeTakenDays: number;
  wasDelayed: boolean;
  delayDays: number;
}

export interface CategoryPattern {
  category: string;
  completedCount: number;
  avgDurationDays: number;
  avgDelayDays: number; // mean days late, among delayed tasks only
  delayRate: number;    // fraction 0-1
}

// Aggregate a list of completion rows into per-category stats.
// Requires at least 2 data points per category to be included
// (avoids noisy one-off outliers influencing Gemini).
export function aggregatePatterns(rows: CompletionRow[]): CategoryPattern[] {
  const buckets = new Map<
    string,
    { totalDuration: number; totalDelay: number; count: number; delayed: number }
  >();

  for (const row of rows) {
    const cat = row.category || "general";
    const b = buckets.get(cat) ?? {
      totalDuration: 0,
      totalDelay: 0,
      count: 0,
      delayed: 0,
    };
    b.count++;
    b.totalDuration += Math.max(0, row.timeTakenDays ?? 0);
    if (row.wasDelayed) {
      b.delayed++;
      b.totalDelay += Math.max(0, row.delayDays ?? 0);
    }
    buckets.set(cat, b);
  }

  return [...buckets.entries()]
    .filter(([, b]) => b.count >= 2)
    .map(([category, b]) => ({
      category,
      completedCount: b.count,
      avgDurationDays: b.totalDuration / b.count,
      avgDelayDays: b.delayed > 0 ? b.totalDelay / b.delayed : 0,
      delayRate: b.delayed / b.count,
    }))
    .sort((a, b) => b.completedCount - a.completedCount);
}

// ---------------------------------------------------------------------------
// Prompt formatting
// ---------------------------------------------------------------------------

// Converts aggregated patterns into a plain-English block that can be
// appended to a Gemini system instruction.
export function formatMemoryForPrompt(patterns: CategoryPattern[]): string {
  if (patterns.length === 0) return "";

  const lines = patterns.map((p) => {
    const parts: string[] = [];

    if (p.avgDelayDays > 0.5) {
      const d = p.avgDelayDays;
      parts.push(
        `typically delayed by ~${d < 1.5 ? "1 day" : `${Math.round(d)} days`}`,
      );
    }
    if (p.avgDurationDays > 0) {
      const d = p.avgDurationDays;
      parts.push(
        `average completion ~${d < 1.5 ? "1 day" : `${Math.round(d)} days`}`,
      );
    }
    if (p.delayRate >= 0.6) {
      parts.push(`runs over schedule ${Math.round(p.delayRate * 100)}% of the time`);
    } else if (p.delayRate < 0.2 && p.avgDurationDays > 0) {
      parts.push("usually completes ahead of schedule");
    }

    const desc =
      parts.length > 0 ? parts.join("; ") : "on track historically";
    return `- "${p.category}" tasks (${p.completedCount} completed): ${desc}`;
  });

  return [
    "## User behavioral memory (from past completed tasks)",
    ...lines,
    "",
    "Apply these patterns when estimating task durations and assigning buffers.",
    "Add extra time where delays are common; reduce estimates where the user is fast.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Client-side fire-and-forget
// ---------------------------------------------------------------------------

// Called from the Zustand store and TaskDetail after a task reaches "done".
// Fires a best-effort POST — never throws.
export function logTaskCompletion(task: Task): void {
  const timeTakenDays =
    (Date.now() - new Date(task.createdAt).getTime()) / MS_PER_DAY;
  const wasDelayed = !!task.dueDate && new Date(task.dueDate) < new Date();
  const delayDays = wasDelayed
    ? Math.max(
        0,
        Math.ceil(
          (Date.now() - new Date(task.dueDate!).getTime()) / MS_PER_DAY,
        ),
      )
    : 0;

  fetch("/api/ai/memory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskTitle: task.title,
      tags: (task.tags ?? []).map((t) => t.name),
      timeTakenDays,
      wasDelayed,
      delayDays,
      dueDate: task.dueDate,
    }),
  }).catch(() => {
    /* best-effort — swallow silently */
  });
}
