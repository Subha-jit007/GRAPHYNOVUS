import type { Tag, Task, TaskPriority, TaskStatus } from "@/types";
import { rowToTag } from "@/lib/tags";

export type TaskRow = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  estimated_hours: number | string | null;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
};

export function rowToTask(row: TaskRow, tags?: Tag[]): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    assigneeId: row.assignee_id,
    // pg returns numeric as string; coerce to number for the client.
    estimatedHours:
      row.estimated_hours === null || row.estimated_hours === undefined
        ? null
        : typeof row.estimated_hours === "string"
          ? Number(row.estimated_hours)
          : row.estimated_hours,
    positionX: row.position_x ?? 0,
    positionY: row.position_y ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}

export const TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
];

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

// PRD §7.2: WIP limit warning on the In-Progress column.
// Defaults loosely follow common kanban WIP conventions.
export const WIP_LIMITS: Partial<Record<TaskStatus, number>> = {
  in_progress: 3,
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-secondary",
  high: "text-yellow-400",
  urgent: "text-destructive",
};

export type TaskTagJoinRow = {
  task_id: string;
  tags: {
    id: string;
    project_id: string;
    name: string;
    color: string | null;
  } | null;
};

export function groupTagsByTask(rows: TaskTagJoinRow[]): Record<string, Tag[]> {
  const out: Record<string, Tag[]> = {};
  for (const row of rows) {
    if (!row.tags) continue;
    (out[row.task_id] ??= []).push(rowToTag(row.tags));
  }
  return out;
}
