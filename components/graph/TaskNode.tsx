"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Task, TaskStatus } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// Status palette per PRD §7.2 Graph View.
// (gray=todo/backlog, blue=in-progress, orange=blocked, yellow=review, green=done)
export const STATUS_COLOR: Record<TaskStatus, string> = {
  backlog: "#4a4a5a",
  todo: "#6e6e88",
  in_progress: "#6C63FF",
  blocked: "#FF8C3D",
  review: "#FFD03D",
  done: "#00FF88",
};

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  dependentCount: number;
  dimmed?: boolean;
}

// Custom React Flow node. Size scales with dependent-task count
// (USP-1: "Critical" tasks that block the most others glow larger).
function TaskNodeImpl({ data, selected }: NodeProps) {
  const { task, dependentCount, dimmed } = data as TaskNodeData;
  const color = STATUS_COLOR[task.status];

  const projectTasks = useProjectStore((s) => s.tasks[task.projectId]);
  const subtaskStats = useMemo(() => {
    const children = projectTasks?.filter((t) => t.parentTaskId === task.id) ?? [];
    return { total: children.length, done: children.filter((t) => t.status === "done").length };
  }, [projectTasks, task.id]);

  // Width grows with dependents, capped. 0→200px, 1→220, ..., cap at ~320.
  const width = Math.min(320, 200 + dependentCount * 20);

  return (
    <div
      className={cn(
        "rounded-xl border-2 backdrop-blur-md transition-opacity",
        "bg-surface/80 px-4 py-3 text-left shadow-lg",
        selected && "ring-2 ring-primary",
        dimmed && "opacity-25",
      )}
      style={{
        width,
        borderColor: color,
        boxShadow: `0 0 ${12 + dependentCount * 3}px ${color}66`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: "none" }}
      />

      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color }}
        >
          {task.status.replace("_", " ")}
        </span>
        {dependentCount > 0 ? (
          <span className="text-[10px] text-muted-foreground font-mono">
            blocks {dependentCount}
          </span>
        ) : null}
      </div>

      <p className="font-medium text-sm line-clamp-2 text-foreground">
        {task.title}
      </p>

      {task.tags && task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] rounded px-1 py-px"
              style={{
                color: tag.color,
                backgroundColor: `${tag.color}1a`,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {subtaskStats.total > 0 ? (
        <div className="mt-2 space-y-0.5">
          <div
            className="h-0.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((subtaskStats.done / subtaskStats.total) * 100)}%`,
                backgroundColor: subtaskStats.done === subtaskStats.total ? "#00FF88" : color,
              }}
            />
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">
            {subtaskStats.done}/{subtaskStats.total} subtasks
          </p>
        </div>
      ) : null}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, width: 8, height: 8, border: "none" }}
      />
    </div>
  );
}

export const TaskNode = memo(TaskNodeImpl);
TaskNode.displayName = "TaskNode";
