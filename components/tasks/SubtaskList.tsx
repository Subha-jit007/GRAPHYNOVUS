"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { Task } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// PRD §5.1: sub-tasks nested up to 3 levels.
// depth=0 → level-1 children  |  depth=1 → level-2  |  depth=2 → level-3 (MAX)
const MAX_DEPTH = 2;

// Stable sentinel — required by Zustand v5 (useSyncExternalStore) to avoid
// creating a new [] reference on every render and triggering an infinite loop.
const EMPTY_TASKS: Task[] = [];

export function SubtaskList({
  parentTask,
  projectId,
  depth = 0,
}: {
  parentTask: Task;
  projectId: string;
  depth?: number;
}) {
  const projectTasks = useProjectStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const createTask   = useProjectStore((s) => s.createTask);
  const updateTask   = useProjectStore((s) => s.updateTask);
  const deleteTask   = useProjectStore((s) => s.deleteTask);
  const moveTask     = useProjectStore((s) => s.moveTask);

  const subtasks = projectTasks.filter((t) => t.parentTaskId === parentTask.id);

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding]     = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) { setAdding(false); return; }
    setNewTitle("");
    try {
      await createTask({
        projectId,
        title,
        parentTaskId: parentTask.id,
        status:       "todo",
        priority:     parentTask.priority,
      });
      // Keep input open so the user can chain-add subtasks quickly.
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

  // ── Progress (root level only) ───────────────────────────────────────────

  const doneCount   = depth === 0 ? subtasks.filter((t) => t.status === "done").length : 0;
  const total       = subtasks.length;
  const progressPct = depth === 0 && total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isComplete  = progressPct === 100;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "space-y-0.5",
        depth > 0 && "ml-5 mt-0.5 border-l border-border/30 pl-3",
      )}
    >
      {/* Progress bar — root level only, only when there are subtasks */}
      {depth === 0 && total > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {doneCount} / {total} done
            </span>
            <span
              className="font-mono text-[11px] font-medium"
              style={{ color: isComplete ? "#00FF88" : "#6C63FF" }}
            >
              {progressPct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width:           `${progressPct}%`,
                backgroundColor: isComplete ? "#00FF88" : "#6C63FF",
              }}
            />
          </div>
        </div>
      )}

      {/* Subtask rows */}
      {subtasks.map((subtask) => (
        <div key={subtask.id}>
          <SubtaskRow
            subtask={subtask}
            onToggle={() => handleToggle(subtask)}
            onRename={(title) => handleRename(subtask, title)}
            onDelete={() => handleDelete(subtask)}
          />
          {/* Recursive nesting — capped at MAX_DEPTH */}
          {depth < MAX_DEPTH && (
            <SubtaskList
              parentTask={subtask}
              projectId={projectId}
              depth={depth + 1}
            />
          )}
        </div>
      ))}

      {/* Quick-add row */}
      {adding ? (
        <div className="flex items-center gap-2 py-0.5 pl-[22px]">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void handleAdd(); }
              if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
            }}
            onBlur={() => {
              if (newTitle.trim()) void handleAdd();
              else setAdding(false);
            }}
            placeholder="Subtask title — press Enter to save"
            className="flex-1 border-b border-primary/40 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 py-0.5 pl-[22px] text-[11px] text-muted-foreground transition-colors hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Add subtask
          {depth === 0 && total > 0 && MAX_DEPTH > depth && (
            <span className="ml-0.5 opacity-50">· max 3 levels</span>
          )}
        </button>
      )}
    </div>
  );
}

// ── SubtaskRow ────────────────────────────────────────────────────────────────

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
  const [editing, setEditing]       = useState(false);
  const [localTitle, setLocalTitle] = useState(subtask.title);

  // Sync title from store without clobbering an in-progress edit.
  useEffect(() => {
    if (!editing) setLocalTitle(subtask.title);
  }, [subtask.title, editing]);

  const commitEdit = () => {
    setEditing(false);
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== subtask.title) onRename(trimmed);
    else setLocalTitle(subtask.title);
  };

  return (
    <div className="-mx-1 flex items-center gap-2 rounded px-1 py-0.5 group/row hover:bg-white/[0.03]">
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
          isDone
            ? "border-primary bg-primary"
            : "border-border/60 hover:border-primary/60",
        )}
      >
        {isDone && <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />}
      </button>

      {/* Title — click-to-edit */}
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
          className="flex-1 border-b border-primary/40 bg-transparent py-px text-sm outline-none"
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
          className={cn(
            "flex-1 cursor-text select-none text-sm leading-relaxed",
            isDone && "text-muted-foreground line-through",
          )}
        >
          {subtask.title}
        </span>
      )}

      {/* Delete — visible on row hover */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete subtask"
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/row:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
