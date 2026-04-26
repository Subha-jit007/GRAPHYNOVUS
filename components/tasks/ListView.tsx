"use client";

import { useEffect, useMemo, useState } from "react";
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
  ListX,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Task, TaskStatus } from "@/types";
import { PRIORITY_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// ─── Stable empty sentinel ────────────────────────────────────────────────────

const EMPTY_TASKS: Task[] = [];

// ─── Status visual metadata ───────────────────────────────────────────────────

const STATUS_ICONS: Record<TaskStatus, LucideIcon> = {
  backlog: Circle,
  todo: CircleDot,
  in_progress: Loader2,
  blocked: AlertCircle,
  review: Clock,
  done: CheckCircle2,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#666680",
  todo: "#00D4FF",
  in_progress: "#6C63FF",
  blocked: "#FF3D6B",
  review: "#FFB800",
  done: "#00FF88",
};

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey = "title" | "status" | "priority" | "dueDate";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  low: 0, medium: 1, high: 2, urgent: 3,
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  backlog: 0, todo: 1, in_progress: 2, blocked: 3, review: 4, done: 5,
};

// ─── ListView ─────────────────────────────────────────────────────────────────

export function ListView({ projectId }: { projectId: string }) {
  const tasks      = useProjectStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const loading    = useProjectStore((s) => s.tasksLoading);
  const error      = useProjectStore((s) => s.tasksError);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const moveTask   = useProjectStore((s) => s.moveTask);
  const deleteTask = useProjectStore((s) => s.deleteTask);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  // null = "All"
  const [filterStatus, setFilterStatus] = useState<TaskStatus | null>(null);
  const [sortKey, setSortKey]           = useState<SortKey>("status");
  const [sortDir, setSortDir]           = useState<SortDir>("asc");
  // Id of the task whose status dropdown is currently open
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    void fetchTasks(projectId);
  }, [projectId, fetchTasks]);

  // Keep detail drawer synced with store updates
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  // Close dropdown on outside pointer-down
  useEffect(() => {
    if (!openDropdownId) return;
    const close = () => setOpenDropdownId(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [openDropdownId]);

  const sorted = useMemo(() => {
    const list = filterStatus
      ? tasks.filter((t) => t.status === filterStatus)
      : [...tasks];

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title")    cmp = a.title.localeCompare(b.title);
      if (sortKey === "status")   cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (sortKey === "priority") cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortKey === "dueDate") {
        if (!a.dueDate && !b.dueDate) cmp = 0;
        else if (!a.dueDate) cmp = 1;
        else if (!b.dueDate) cmp = -1;
        else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [tasks, filterStatus, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  if (error && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col gap-3">

        {/* ── Filter chips ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* "All" chip */}
          <button
            type="button"
            onClick={() => setFilterStatus(null)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
              filterStatus === null
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            All
            <span className="tabular-nums text-[10px] text-muted-foreground/70">
              {tasks.length}
            </span>
          </button>

          {TASK_STATUSES.map((s) => {
            const count  = tasks.filter((t) => t.status === s).length;
            const active = filterStatus === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus((prev) => (prev === s ? null : s))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[s] }}
                />
                {STATUS_LABELS[s]}
                <span className="tabular-nums text-[10px] text-muted-foreground/70">{count}</span>
              </button>
            );
          })}

          {filterStatus && (
            <span className="ml-auto tabular-nums text-xs text-muted-foreground">
              {sorted.length} / {tasks.length}
            </span>
          )}
        </div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface/80 text-xs uppercase tracking-wider backdrop-blur-sm">
                <SortTh
                  label="Status"
                  sortKey="status"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="w-40 px-4 py-3 text-left"
                />
                <SortTh
                  label="Title"
                  sortKey="title"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="min-w-[240px] px-4 py-3 text-left"
                />
                <SortTh
                  label="Priority"
                  sortKey="priority"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="w-24 px-4 py-3 text-left"
                />
                <SortTh
                  label="Due Date"
                  sortKey="dueDate"
                  active={sortKey}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="w-28 px-4 py-3 text-left"
                />
                <th className="px-4 py-3 text-left text-muted-foreground">Tags</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading tasks…</p>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ListX className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {filterStatus
                        ? `No ${STATUS_LABELS[filterStatus].toLowerCase()} tasks.`
                        : "No tasks yet. Create one or use Cortex."}
                    </p>
                  </td>
                </tr>
              ) : (
                sorted.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    dropdownOpen={openDropdownId === task.id}
                    onOpen={() => {
                      setSelectedTask(task);
                      setDetailOpen(true);
                    }}
                    onStatusDotClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId((prev) => (prev === task.id ? null : task.id));
                    }}
                    onStatusChange={async (status) => {
                      setOpenDropdownId(null);
                      await moveTask(projectId, task.id, status);
                    }}
                    onDelete={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete "${task.title}"?`)) return;
                      await deleteTask(projectId, task.id);
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

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  dropdownOpen,
  onOpen,
  onStatusDotClick,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  dropdownOpen: boolean;
  onOpen: () => void;
  onStatusDotClick: (e: React.MouseEvent) => void;
  onStatusChange: (status: TaskStatus) => Promise<void>;
  onDelete: (e: React.MouseEvent) => Promise<void>;
}) {
  const StatusIcon = STATUS_ICONS[task.status];
  const dotColor   = STATUS_COLORS[task.status];

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-border/40 transition-colors hover:bg-primary/5 last:border-0"
    >
      {/* Status dropdown cell */}
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onStatusDotClick}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition hover:bg-surface"
            style={{ color: dotColor }}
            title="Click to change status"
          >
            <StatusIcon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                task.status === "in_progress" && "animate-spin",
              )}
              style={task.status === "in_progress" ? { animationDuration: "3s" } : undefined}
            />
            {STATUS_LABELS[task.status]}
          </button>

          {dropdownOpen && (
            <div
              className="absolute left-0 top-9 z-50 w-40 rounded-lg border border-border bg-surface/95 py-1 shadow-2xl backdrop-blur-sm"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {TASK_STATUSES.map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void onStatusChange(s)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition hover:bg-primary/10",
                      task.status === s && "bg-primary/10",
                    )}
                    style={{ color: STATUS_COLORS[s] }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-foreground">{STATUS_LABELS[s]}</span>
                    {task.status === s && (
                      <span className="ml-auto text-primary">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </td>

      {/* Title + optional description snippet */}
      <td className="max-w-xs px-4 py-2.5">
        <p className="line-clamp-1 font-medium text-foreground">{task.title}</p>
        {task.description ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </td>

      {/* Priority */}
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "font-mono text-xs uppercase tracking-wide",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {task.priority}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-4 py-2.5">
        {task.dueDate ? (
          <DueDateCell dueDate={task.dueDate} done={task.status === "done"} />
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        )}
      </td>

      {/* Tags */}
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {task.tags?.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{
                color: tag.color ?? undefined,
                borderColor: `${tag.color ?? "#666"}55`,
                backgroundColor: `${tag.color ?? "#666"}14`,
              }}
            >
              {tag.name}
            </span>
          ))}
          {(task.tags?.length ?? 0) > 4 && (
            <span className="text-[10px] text-muted-foreground">
              +{task.tags!.length - 4}
            </span>
          )}
        </div>
      </td>

      {/* Delete action */}
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => void onDelete(e)}
          className="text-muted-foreground/30 transition hover:text-destructive"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── SortTh ───────────────────────────────────────────────────────────────────

function SortTh({
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
  onToggle: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = active === key;
  return (
    <th
      className={cn(
        "cursor-pointer select-none py-3 text-left transition hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      onClick={() => onToggle(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc"
            ? <ArrowUp className="h-3 w-3 shrink-0" />
            : <ArrowDown className="h-3 w-3 shrink-0" />
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" />
        )}
      </div>
    </th>
  );
}

// ─── DueDateCell ──────────────────────────────────────────────────────────────

function DueDateCell({ dueDate, done }: { dueDate: string; done: boolean }) {
  const d       = new Date(dueDate);
  const now     = Date.now();
  const overdue = !done && d.getTime() < now;
  const soon    = !done && !overdue && d.getTime() - now < 48 * 3_600_000;
  return (
    <span
      className={cn(
        "text-xs",
        overdue ? "font-medium text-[#FF3D6B]" : soon ? "text-yellow-400" : "text-muted-foreground",
      )}
    >
      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      {overdue && <span className="ml-0.5 text-[10px]">!</span>}
    </span>
  );
}
