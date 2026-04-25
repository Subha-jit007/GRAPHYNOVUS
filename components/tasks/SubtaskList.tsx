"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { Task } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// PRD §5.1: sub-tasks nested up to 3 levels.
// depth=0 → level-1 children of the parent task
// depth=1 → level-2, depth=2 → level-3 (MAX_DEPTH)
const MAX_DEPTH = 2;

export function SubtaskList({
  parentTask,
  projectId,
  depth = 0,
}: {
  parentTask: Task;
  projectId: string;
  depth?: number;
}) {
  const projectTasks = useProjectStore((s) => s.tasks[projectId]);
  const createTask = useProjectStore((s) => s.createTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const moveTask = useProjectStore((s) => s.moveTask);

  const subtasks = projectTasks?.filter((t) => t.parentTaskId === parentTask.id) ?? [];

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    setNewTitle("");
    try {
      await createTask({
        projectId,
        title,
        parentTaskId: parentTask.id,
        status: "todo",
        priority: parentTask.priority,
      });
      // Keep input open so user can chain-add subtasks.
    } catch {
      setNewTitle(title); // restore on error
    }
  };

  const handleToggle = (subtask: Task) => {
    void moveTask(projectId, subtask.id, subtask.status === "done" ? "todo" : "done");
  };

  const handleRename = (subtask: Task, title: string) => {
    void updateTask(projectId, subtask.id, { title });
  };

  const handleDelete = (subtask: Task) => {
    void deleteTask(projectId, subtask.id);
  };

  // Progress bar — only rendered at the root level (depth === 0).
  const doneCount = depth === 0 ? subtasks.filter((t) => t.status === "done").length : 0;
  const progressPct =
    depth === 0 && subtasks.length > 0
      ? Math.round((doneCount / subtasks.length) * 100)
      : 0;

  return (
    <div className={cn("space-y-0.5", depth > 0 && "ml-5 pl-3 border-l border-border/40 mt-0.5")}>
      {/* Inline progress summary at root depth */}
      {depth === 0 && subtasks.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                backgroundColor: progressPct === 100 ? "#00FF88" : "#6C63FF",
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {doneCount}/{subtasks.length}
          </span>
        </div>
      )}

      {/* Rows */}
      {subtasks.map((subtask) => (
        <div key={subtask.id}>
          <SubtaskRow
            subtask={subtask}
            onToggle={() => handleToggle(subtask)}
            onRename={(title) => handleRename(subtask, title)}
            onDelete={() => handleDelete(subtask)}
          />
          {depth < MAX_DEPTH && (
            <SubtaskList parentTask={subtask} projectId={projectId} depth={depth + 1} />
          )}
        </div>
      ))}

      {/* Quick-add */}
      {adding ? (
        <div className="flex items-center gap-2 py-0.5 pl-[22px]">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setNewTitle("");
              }
            }}
            onBlur={() => {
              if (newTitle.trim()) void handleAdd();
              else setAdding(false);
            }}
            placeholder="Subtask title…"
            className="flex-1 text-sm bg-transparent border-b border-primary/50 outline-none py-0.5 placeholder:text-muted-foreground/40"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5 pl-[22px]"
        >
          <Plus className="w-3 h-3" />
          Add subtask
        </button>
      )}
    </div>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
  onRename,
  onDelete,
}: {
  subtask: Task;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const isDone = subtask.status === "done";
  const [editing, setEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(subtask.title);

  // Track store updates but don't clobber an in-progress edit.
  useEffect(() => {
    if (!editing) setLocalTitle(subtask.title);
  }, [subtask.title, editing]);

  const commitEdit = () => {
    setEditing(false);
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== subtask.title) {
      onRename(trimmed);
    } else {
      setLocalTitle(subtask.title);
    }
  };

  return (
    <div className="flex items-center gap-2 group/row py-0.5 rounded hover:bg-white/[0.03] px-1 -mx-1">
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors",
          isDone ? "bg-primary border-primary" : "border-border/60 hover:border-primary/60",
        )}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
      >
        {isDone && <Check className="w-2.5 h-2.5 text-background" strokeWidth={3} />}
      </button>

      {/* Title — click to inline-edit */}
      {editing ? (
        <input
          autoFocus
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              commitEdit();
            }
          }}
          onBlur={commitEdit}
          className="flex-1 text-sm bg-transparent border-b border-primary/40 outline-none py-px"
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(true);
          }}
          className={cn(
            "flex-1 text-sm cursor-text select-none leading-relaxed",
            isDone && "line-through text-muted-foreground",
          )}
        >
          {subtask.title}
        </span>
      )}

      {/* Delete — visible on row hover */}
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
        aria-label="Delete subtask"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
