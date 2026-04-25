"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Loader2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@/types";
import {
  PRIORITY_COLORS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/tasks";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Status metadata ──────────────────────────────────────────────────────

const STATUS_ICONS: Record<TaskStatus, LucideIcon> = {
  backlog: Circle,
  todo: CircleDot,
  in_progress: Loader2,
  blocked: AlertCircle,
  review: Clock,
  done: CheckCircle2,
};

const STATUS_ICON_COLORS: Record<TaskStatus, string> = {
  backlog: "text-muted-foreground",
  todo: "text-[#00D4FF]",
  in_progress: "text-[#6C63FF]",
  blocked: "text-[#FF3D6B]",
  review: "text-yellow-400",
  done: "text-[#00FF88]",
};

// ─── Per-task entropy score ───────────────────────────────────────────────

function taskEntropyScore(task: Task): number {
  if (task.status === "done") return 0;
  const now = Date.now();
  let score = 0;
  const daysSinceUpdate = (now - new Date(task.updatedAt).getTime()) / 86_400_000;
  if (daysSinceUpdate > 3) score += 30;
  if (task.status === "blocked") score += 25;
  if (task.dueDate) {
    const hoursLeft = (new Date(task.dueDate).getTime() - now) / 3_600_000;
    if (hoursLeft < 0) score += 25;
    else if (hoursLeft < 48) score += 15;
  }
  if (task.status === "in_progress") score += 5;
  return Math.min(score, 100);
}

function entropyColor(score: number): string {
  if (score <= 30) return "#00FF88";
  if (score <= 60) return "#FFB800";
  return "#FF3D6B";
}

// ─── Sort types ───────────────────────────────────────────────────────────

type SortKey = "title" | "status" | "priority" | "dueDate" | "entropy";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  blocked: 3,
  review: 4,
  done: 5,
};

// ─── ListView ─────────────────────────────────────────────────────────────

export function ListView({ projectId }: { projectId: string }) {
  const tasks = useProjectStore((s) => s.tasks[projectId] ?? []);
  const loading = useProjectStore((s) => s.tasksLoading);
  const error = useProjectStore((s) => s.tasksError);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const fetchTags = useProjectStore((s) => s.fetchTags);
  const projectTags = useProjectStore((s) => s.tags[projectId] ?? []);
  const moveTask = useProjectStore((s) => s.moveTask);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const updateTask = useProjectStore((s) => s.updateTask);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<Set<TaskStatus>>(new Set());
  const [filterPriority, setFilterPriority] = useState<Set<TaskPriority>>(new Set());
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>("todo");
  const [bulkAssignee, setBulkAssignee] = useState("");

  // Keyboard nav (row index)
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Inline status dropdown open for task id
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

  useEffect(() => {
    void fetchTasks(projectId);
    void fetchTags(projectId);
  }, [projectId, fetchTasks, fetchTags]);

  // Keep open detail drawer in sync when store updates the task
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusDropdown) return;
    const close = () => setStatusDropdown(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [statusDropdown]);

  const sortedFiltered = useMemo(() => {
    let result = [...tasks];

    if (filterStatus.size > 0)
      result = result.filter((t) => filterStatus.has(t.status));
    if (filterPriority.size > 0)
      result = result.filter((t) => filterPriority.has(t.priority));
    if (filterTags.size > 0)
      result = result.filter((t) => t.tags?.some((tag) => filterTags.has(tag.id)));

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case "priority":
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case "dueDate":
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) cmp = 1;
          else if (!b.dueDate) cmp = -1;
          else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case "entropy":
          cmp = taskEntropyScore(a) - taskEntropyScore(b);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tasks, filterStatus, filterPriority, filterTags, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const allSelected =
    sortedFiltered.length > 0 && sortedFiltered.every((t) => selected.has(t.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sortedFiltered.map((t) => t.id)));
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't intercept arrow keys when an input/select has focus
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, sortedFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      const t = sortedFiltered[focusedIndex];
      if (t) openTask(t);
    }
  };

  const handleBulkStatus = async () => {
    await Promise.all([...selected].map((id) => moveTask(projectId, id, bulkStatus)));
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} task(s)?`)) return;
    await Promise.all([...selected].map((id) => deleteTask(projectId, id)));
    setSelected(new Set());
  };

  const handleBulkAssign = async () => {
    await Promise.all(
      [...selected].map((id) =>
        updateTask(projectId, id, { assigneeId: bulkAssignee || null }),
      ),
    );
    setSelected(new Set());
    setBulkAssignee("");
  };

  if (error && tasks.length === 0) {
    return <p className="text-sm text-destructive p-4">{error}</p>;
  }

  const anyFilters = filterStatus.size > 0 || filterPriority.size > 0 || filterTags.size > 0;

  return (
    <>
      <div className="space-y-3" onKeyDown={handleKeyDown}>
        {/* ── Filter bar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2">
          <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
            Filter
          </span>

          {TASK_STATUSES.map((s) => {
            const Icon = STATUS_ICONS[s];
            const active = filterStatus.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setFilterStatus((prev) => {
                    const next = new Set(prev);
                    if (next.has(s)) next.delete(s);
                    else next.add(s);
                    return next;
                  })
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition",
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                <Icon className={cn("h-3 w-3 shrink-0", STATUS_ICON_COLORS[s])} />
                {STATUS_LABELS[s]}
              </button>
            );
          })}

          <div className="mx-1 h-4 w-px shrink-0 bg-border" />

          {TASK_PRIORITIES.map((p) => {
            const active = filterPriority.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() =>
                  setFilterPriority((prev) => {
                    const next = new Set(prev);
                    if (next.has(p)) next.delete(p);
                    else next.add(p);
                    return next;
                  })
                }
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition",
                  active ? "border-primary/60 bg-primary/15" : "border-border hover:border-primary/30",
                  PRIORITY_COLORS[p],
                )}
              >
                {p}
              </button>
            );
          })}

          {projectTags.length > 0 && (
            <>
              <div className="mx-1 h-4 w-px shrink-0 bg-border" />
              {projectTags.map((tag) => {
                const active = filterTags.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setFilterTags((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag.id)) next.delete(tag.id);
                        else next.add(tag.id);
                        return next;
                      })
                    }
                    className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition"
                    style={
                      active
                        ? {
                            backgroundColor: `${tag.color}22`,
                            borderColor: `${tag.color}88`,
                            color: tag.color,
                          }
                        : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </>
          )}

          {anyFilters && (
            <button
              type="button"
              onClick={() => {
                setFilterStatus(new Set());
                setFilterPriority(new Set());
                setFilterTags(new Set());
              }}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Clear
            </button>
          )}

          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {sortedFiltered.length} / {tasks.length}
          </span>
        </div>

        {/* ── Bulk action bar ────────────────────────────── */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
                className="h-7 rounded border border-border bg-surface/60 px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => void handleBulkStatus()}>
                Set status
              </Button>
              <div className="h-5 w-px shrink-0 bg-border" />
              <input
                className="h-7 w-32 rounded border border-border bg-surface/60 px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                placeholder="Assignee ID…"
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => void handleBulkAssign()}>
                Assign
              </Button>
              <div className="h-5 w-px shrink-0 bg-border" />
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-destructive hover:text-destructive"
                onClick={() => void handleBulkDelete()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────── */}
        <div className="overflow-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/70 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-primary"
                    aria-label="Select all tasks"
                  />
                </th>
                {/* Status icon column — not sortable */}
                <th className="w-8 px-2 py-3" />
                <SortHeader
                  label="Title"
                  sortKey="title"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="min-w-[220px] px-3 text-left"
                />
                <SortHeader
                  label="Priority"
                  sortKey="priority"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="w-24 px-3 text-left"
                />
                <th className="w-32 px-3 py-3 text-left">Assignee</th>
                <SortHeader
                  label="Due Date"
                  sortKey="dueDate"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="w-28 px-3 text-left"
                />
                <th className="px-3 py-3 text-left">Tags</th>
                <SortHeader
                  label="Entropy"
                  sortKey="entropy"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="w-28 px-3 text-left"
                />
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : sortedFiltered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    {anyFilters ? "No tasks match the current filters." : "No tasks yet."}
                  </td>
                </tr>
              ) : (
                sortedFiltered.map((task, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    focused={focusedIndex === idx}
                    checked={selected.has(task.id)}
                    statusDropdownOpen={statusDropdown === task.id}
                    onOpen={openTask}
                    onCheck={() => toggleOne(task.id)}
                    onFocus={() => setFocusedIndex(idx)}
                    onStatusIconClick={(e) => {
                      e.stopPropagation();
                      setStatusDropdown((prev) => (prev === task.id ? null : task.id));
                    }}
                    onInlineStatus={async (id, s) => {
                      await moveTask(projectId, id, s);
                      setStatusDropdown(null);
                    }}
                    onDelete={async () => {
                      if (!confirm(`Delete "${task.title}"?`)) return;
                      await deleteTask(projectId, task.id);
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.delete(task.id);
                        return next;
                      });
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TaskDetail
        task={selectedTask}
        projectId={projectId}
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setSelectedTask(null);
        }}
      />
    </>
  );
}

// ─── TaskRow ──────────────────────────────────────────────────────────────

function TaskRow({
  task,
  focused,
  checked,
  statusDropdownOpen,
  onOpen,
  onCheck,
  onFocus,
  onStatusIconClick,
  onInlineStatus,
  onDelete,
}: {
  task: Task;
  focused: boolean;
  checked: boolean;
  statusDropdownOpen: boolean;
  onOpen: (task: Task) => void;
  onCheck: () => void;
  onFocus: () => void;
  onStatusIconClick: (e: React.MouseEvent) => void;
  onInlineStatus: (id: string, status: TaskStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const entropy = taskEntropyScore(task);
  const StatusIcon = STATUS_ICONS[task.status];

  useEffect(() => {
    if (focused) rowRef.current?.focus();
  }, [focused]);

  return (
    <tr
      ref={rowRef}
      tabIndex={0}
      onFocus={onFocus}
      onClick={() => onOpen(task)}
      className={cn(
        "cursor-pointer border-b border-border/50 outline-none transition-colors",
        "hover:bg-primary/5",
        focused && "bg-primary/10 ring-1 ring-inset ring-primary/30",
        checked && !focused && "bg-primary/5",
      )}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          className="accent-primary"
          aria-label={`Select: ${task.title}`}
        />
      </td>

      {/* Status icon + inline dropdown */}
      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            type="button"
            onClick={onStatusIconClick}
            className={cn("block transition hover:opacity-70", STATUS_ICON_COLORS[task.status])}
            title={`${STATUS_LABELS[task.status]} — click to change`}
          >
            <StatusIcon
              className={cn("h-4 w-4", task.status === "in_progress" && "animate-spin")}
              style={task.status === "in_progress" ? { animationDuration: "3s" } : undefined}
            />
          </button>

          {statusDropdownOpen && (
            <div className="absolute left-0 top-6 z-30 w-36 rounded-lg border border-border bg-surface py-1 shadow-xl">
              {TASK_STATUSES.map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onInlineStatus(task.id, s);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition hover:bg-primary/10",
                      task.status === s && "bg-primary/10",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_ICON_COLORS[s])} />
                    <span className="text-foreground">{STATUS_LABELS[s]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </td>

      {/* Title */}
      <td className="max-w-xs px-3 py-2.5">
        <p className="line-clamp-1 font-medium">{task.title}</p>
        {task.parentTaskId && (
          <p className="text-[10px] text-muted-foreground">subtask</p>
        )}
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "font-mono text-xs uppercase tracking-wide",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {task.priority}
        </span>
      </td>

      {/* Assignee */}
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {task.assigneeId ? `${task.assigneeId.slice(0, 8)}…` : "—"}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-3 py-2.5">
        {task.dueDate ? (
          <DueDateBadge dueDate={task.dueDate} done={task.status === "done"} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Tags */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {task.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{
                color: tag.color,
                borderColor: `${tag.color}55`,
                backgroundColor: `${tag.color}14`,
              }}
            >
              {tag.name}
            </span>
          ))}
          {(task.tags?.length ?? 0) > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{task.tags!.length - 3}
            </span>
          )}
        </div>
      </td>

      {/* Entropy contribution */}
      <td className="px-3 py-2.5">
        <EntropyBar score={entropy} />
      </td>

      {/* Delete action */}
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => void onDelete()}
          className="text-muted-foreground transition hover:text-destructive"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── SortHeader ───────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey: key,
  active,
  dir,
  onToggle,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onToggle: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = active === key;
  return (
    <th
      className={cn(
        "cursor-pointer select-none py-3 transition hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      onClick={() => onToggle(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3 shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" />
        )}
      </div>
    </th>
  );
}

// ─── DueDateBadge ─────────────────────────────────────────────────────────

function DueDateBadge({ dueDate, done }: { dueDate: string; done: boolean }) {
  const d = new Date(dueDate);
  const now = Date.now();
  const overdue = !done && d.getTime() < now;
  const soon = !done && !overdue && d.getTime() - now < 48 * 3_600_000;
  return (
    <span
      className={cn(
        "text-xs",
        overdue ? "text-[#FF3D6B]" : soon ? "text-yellow-400" : "text-muted-foreground",
      )}
    >
      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      {overdue && " !"}
    </span>
  );
}

// ─── EntropyBar ───────────────────────────────────────────────────────────

function EntropyBar({ score }: { score: number }) {
  if (score === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const color = entropyColor(score);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="tabular-nums text-[10px] font-mono" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
