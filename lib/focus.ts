// Today's Focus scoring engine (PRD §5.4 — "AI-curated 3-5 most important tasks").
// Pure function — no I/O, easy to unit-test.

import type { Project, Task, TaskDependency, TaskPriority } from "@/types";

export type FocusReason =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "blocker"
  | "stale"
  | "high_priority";

export interface FocusProject {
  id: string;
  title: string;
  color: string | null;
  icon: string | null;
}

export interface FocusItem {
  task: Task;
  project: FocusProject;
  score: number;
  reasons: FocusReason[];
}

// ---------------------------------------------------------------------------
// Score weights (max total ≈ 100)
// ---------------------------------------------------------------------------
// Priority:      0–10
// Due urgency:   0–40
// Blocker:       0–30
// Stale:         0–20
// Status bonus:  0–8

const PRIORITY_SCORE: Record<TaskPriority, number> = {
  urgent: 10,
  high: 7,
  medium: 3,
  low: 1,
};

const MS_PER_DAY = 86_400_000;

// Statuses worth surfacing in the focus list.
// "backlog" is included only when a task is overdue — filtered during scoring.
const ACTIVE_STATUSES = new Set(["todo", "in_progress", "blocked", "review", "backlog"]);

export function scoreTasks(opts: {
  tasks: Task[];
  projects: Project[];
  dependencies: TaskDependency[];
  now?: Date;
  limit?: number;
}): FocusItem[] {
  const { tasks, projects, dependencies, now = new Date(), limit = 5 } = opts;

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Midnight of today in local time — used for day-level due comparisons.
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  // Map: taskId → number of "blocks" outgoing edges (how many tasks this blocks)
  const blockedByTask = new Map<string, number>();
  for (const dep of dependencies) {
    if (dep.type !== "blocks") continue;
    blockedByTask.set(dep.sourceTaskId, (blockedByTask.get(dep.sourceTaskId) ?? 0) + 1);
  }

  const scored: FocusItem[] = [];

  for (const task of tasks) {
    if (task.status === "done") continue;
    if (!ACTIVE_STATUSES.has(task.status)) continue;

    const project = projectMap.get(task.projectId);
    if (!project) continue; // task from an archived/unknown project

    let score = 0;
    const reasons = new Set<FocusReason>();

    // 1. Priority (0–10)
    score += PRIORITY_SCORE[task.priority] ?? 3;
    if (task.priority === "urgent" || task.priority === "high") {
      reasons.add("high_priority");
    }

    // 2. Due urgency (0–40)
    if (task.dueDate) {
      const dueDayMs = new Date(task.dueDate).setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((dueDayMs - todayMs) / MS_PER_DAY);

      if (daysUntilDue < 0) {
        score += 40;
        reasons.add("overdue");
      } else if (daysUntilDue === 0) {
        score += 30;
        reasons.add("due_today");
      } else if (daysUntilDue === 1) {
        score += 20;
        reasons.add("due_soon");
      } else if (daysUntilDue <= 3) {
        score += 10;
        reasons.add("due_soon");
      }
    } else if (task.status === "backlog") {
      // Backlog tasks with no due date rarely deserve focus — skip them.
      continue;
    }

    // 3. Blocker importance (0–30)
    const blocking = blockedByTask.get(task.id) ?? 0;
    if (blocking > 0) {
      score += Math.min(30, blocking * 10);
      reasons.add("blocker");
    }

    // 4. Stale detection (0–20): todo/backlog tasks the user has been avoiding
    if (task.status === "todo" || task.status === "backlog") {
      const daysSinceUpdate =
        (now.getTime() - new Date(task.updatedAt).getTime()) / MS_PER_DAY;
      if (daysSinceUpdate >= 7) {
        score += 20;
        reasons.add("stale");
      } else if (daysSinceUpdate >= 3) {
        score += 10;
        reasons.add("stale");
      }
    }

    // 5. Status bonus
    if (task.status === "blocked") score += 8;
    if (task.status === "in_progress") score += 5;

    scored.push({
      task,
      project: {
        id: project.id,
        title: project.title,
        color: project.color,
        icon: project.icon,
      },
      score,
      reasons: [...reasons],
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Human-readable reason labels (used by both the badge and the Gemini prompt)
// ---------------------------------------------------------------------------

export const REASON_LABELS: Record<FocusReason, string> = {
  overdue: "overdue",
  due_today: "due today",
  due_soon: "due soon",
  blocker: "blocking others",
  stale: "long untouched",
  high_priority: "high priority",
};

export const REASON_COLORS: Record<FocusReason, string> = {
  overdue: "bg-[#FF3D6B]/15 text-[#FF3D6B] border-[#FF3D6B]/30",
  due_today: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  due_soon: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  blocker: "bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/30",
  stale: "bg-white/5 text-muted-foreground border-border",
  high_priority: "bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/30",
};
