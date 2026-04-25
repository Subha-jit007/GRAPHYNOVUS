"use client";

import { useMemo } from "react";
import { Calendar, Clock, GitBranch } from "lucide-react";
import type { Task } from "@/types";
import { PRIORITY_COLORS } from "@/lib/tasks";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// Compact Kanban card (PRD §7.2).
// Shows priority dot, title, tag chips, due date, and time estimate.
export function TaskCard({
  task,
  onOpen,
  dragging = false,
}: {
  task: Task;
  onOpen?: (task: Task) => void;
  dragging?: boolean;
}) {
  const projectTasks = useProjectStore((s) => s.tasks[task.projectId]);
  const subtaskStats = useMemo(() => {
    const children = projectTasks?.filter((t) => t.parentTaskId === task.id) ?? [];
    return { total: children.length, done: children.filter((t) => t.status === "done").length };
  }, [projectTasks, task.id]);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(task)}
      className={cn(
        "w-full text-left rounded-lg border border-border bg-background/80 p-3 space-y-2",
        "hover:border-primary/40 transition cursor-pointer",
        dragging && "opacity-50 ring-2 ring-primary",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("text-[10px] font-mono uppercase tracking-wider", PRIORITY_COLORS[task.priority])}
          aria-label={`Priority ${task.priority}`}
        >
          {task.priority}
        </span>
        {task.parentTaskId ? (
          <GitBranch className="w-3 h-3 text-muted-foreground" aria-label="Sub-task" />
        ) : null}
      </div>

      <p className="font-medium text-sm line-clamp-2">{task.title}</p>

      {task.tags && task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] rounded px-1.5 py-0.5 border"
              style={{
                color: tag.color,
                borderColor: `${tag.color}55`,
                backgroundColor: `${tag.color}14`,
              }}
            >
              {tag.name}
            </span>
          ))}
          {task.tags.length > 4 ? (
            <span className="text-[10px] text-muted-foreground">+{task.tags.length - 4}</span>
          ) : null}
        </div>
      ) : null}

      {subtaskStats.total > 0 ? (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-0.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((subtaskStats.done / subtaskStats.total) * 100)}%`,
                backgroundColor: subtaskStats.done === subtaskStats.total ? "#00FF88" : "#6C63FF",
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {subtaskStats.done}/{subtaskStats.total}
          </span>
        </div>
      ) : null}

      {(task.dueDate || task.estimatedHours) ? (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDueDate(task.dueDate)}
            </span>
          ) : null}
          {task.estimatedHours ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.estimatedHours}h
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
