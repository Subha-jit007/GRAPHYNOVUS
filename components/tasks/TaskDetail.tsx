"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import type { Tag, Task } from "@/types";
import {
  PRIORITY_COLORS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// Full edit form for every §5.1 task property.
// Opens when a TaskCard is clicked; saves on explicit Save (no autosave to
// keep the form predictable while the user is typing).
export function TaskDetail({
  task,
  projectId,
  open,
  onOpenChange,
}: {
  task: Task | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateTask = useProjectStore((s) => s.updateTask);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const createTag = useProjectStore((s) => s.createTag);
  const fetchTags = useProjectStore((s) => s.fetchTags);
  const projectTags = useProjectStore((s) => s.tags[projectId] ?? []);

  const [form, setForm] = useState(() => taskToForm(task));
  const [tagIds, setTagIds] = useState<Set<string>>(() => new Set(task?.tags?.map((t) => t.id) ?? []));
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local form whenever a different task is opened.
  useEffect(() => {
    setForm(taskToForm(task));
    setTagIds(new Set(task?.tags?.map((t) => t.id) ?? []));
    setError(null);
  }, [task]);

  // Load project tags once when the dialog opens.
  useEffect(() => {
    if (open) void fetchTags(projectId);
  }, [open, projectId, fetchTags]);

  const dirty = useMemo(() => {
    if (!task) return false;
    if (form.title.trim() !== task.title) return true;
    if ((form.description || null) !== (task.description || null)) return true;
    if (form.status !== task.status) return true;
    if (form.priority !== task.priority) return true;
    if ((form.dueDate || null) !== (task.dueDate ? task.dueDate.slice(0, 10) : null)) return true;
    if ((form.assigneeId || null) !== (task.assigneeId || null)) return true;
    if (nullableNumber(form.estimatedHours) !== (task.estimatedHours ?? null)) return true;
    const currentTagIds = new Set(task.tags?.map((t) => t.id) ?? []);
    if (currentTagIds.size !== tagIds.size) return true;
    for (const id of tagIds) if (!currentTagIds.has(id)) return true;
    return false;
  }, [form, tagIds, task]);

  if (!task) return null;

  const toggleTag = (id: string) => {
    setTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const tag = await createTag(projectId, name);
      setTagIds((prev) => new Set(prev).add(tag.id));
      setNewTagName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    }
  };

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTask(projectId, task.id, {
        title,
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        assigneeId: form.assigneeId.trim() || null,
        estimatedHours: nullableNumber(form.estimatedHours),
        tagIds: Array.from(tagIds),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTask(projectId, task.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-xl font-bold flex-1">
              Edit task
            </Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Edit every property of this task.
          </Dialog.Description>

          <div className="space-y-3">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Add details, links, acceptance criteria…"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                  className="w-full h-10 rounded-lg border border-border bg-surface/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}
                  className={cn(
                    "w-full h-10 rounded-lg border border-border bg-surface/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    PRIORITY_COLORS[form.priority],
                  )}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p} className="text-foreground">
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date">
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </Field>

              <Field label="Estimated hours">
                <Input
                  type="number"
                  min={0}
                  step={0.25}
                  value={form.estimatedHours}
                  onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
                  placeholder="e.g. 4"
                />
              </Field>
            </div>

            <Field label="Assignee (user ID)" hint="Team invites land in Phase 2 — leave blank for self.">
              <Input
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                placeholder="user uuid"
              />
            </Field>

            <Field label="Tags">
              <div className="space-y-2">
                <TagPicker tags={projectTags} selected={tagIds} onToggle={toggleTag} />
                <div className="flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateTag();
                      }
                    }}
                    placeholder="New tag name"
                    maxLength={40}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleCreateTag}>
                    Add tag
                  </Button>
                </div>
              </div>
            </Field>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                size="sm"
                disabled={!dirty || saving}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function TagPicker({
  tags,
  selected,
  onToggle,
}: {
  tags: Tag[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (tags.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No tags yet. Create the first one below.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const active = selected.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            className={cn(
              "text-xs rounded px-2 py-0.5 border transition",
              active ? "border-transparent" : "border-border hover:border-primary/40",
            )}
            style={
              active
                ? { backgroundColor: `${tag.color}33`, color: tag.color, borderColor: `${tag.color}88` }
                : undefined
            }
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

type FormShape = {
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  dueDate: string; // yyyy-mm-dd for <input type="date">
  assigneeId: string;
  estimatedHours: string;
};

function taskToForm(task: Task | null): FormShape {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "backlog",
    priority: task?.priority ?? "medium",
    dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
    assigneeId: task?.assigneeId ?? "",
    estimatedHours:
      task?.estimatedHours === null || task?.estimatedHours === undefined
        ? ""
        : String(task.estimatedHours),
  };
}

function nullableNumber(input: string): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}
