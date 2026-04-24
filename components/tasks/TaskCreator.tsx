"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { TaskStatus } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// Quick-add row at the bottom of a Kanban column (PRD §7.2).
// Creates the task with the column's status so the card lands in-place.
export function TaskCreator({
  projectId,
  status,
  className,
}: {
  projectId: string;
  status: TaskStatus;
  className?: string;
}) {
  const createTask = useProjectStore((s) => s.createTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setError(null);
    setSubmitting(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTask({ projectId, title: trimmed, status });
      reset();
      // Keep the row open so the user can rapidly add more cards.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full text-left text-xs text-muted-foreground hover:text-foreground transition",
          "inline-flex items-center gap-1.5 px-1 py-1.5",
          className,
        )}
      >
        <Plus className="w-3 h-3" />
        Add task
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-1.5", className)}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) {
            setOpen(false);
            reset();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            reset();
          }
        }}
        placeholder="Task title"
        disabled={submitting}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
      />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </form>
  );
}
