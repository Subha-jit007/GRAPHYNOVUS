"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { Task, TaskDependency, TaskStatus } from "@/types";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// ── Stable empty sentinels ────────────────────────────────────────────────────
const EMPTY_TASKS: Task[] = [];
const EMPTY_DEPS: TaskDependency[] = [];

// ── Layout constants ──────────────────────────────────────────────────────────
const LABEL_W  = 280;  // left task-list panel width (px)
const ROW_H    = 44;   // each task row (px)
const GROUP_H  = 32;   // status group header (px)
const HEADER_H = 48;   // sticky date header (px)
const PAD_S    = 7;    // days before earliest event
const PAD_E    = 21;   // days after latest event
const MS_DAY   = 86_400_000;

// ── Status colors — match the rest of the app ─────────────────────────────────
const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog:     "#666680",
  todo:        "#00D4FF",
  in_progress: "#6C63FF",
  blocked:     "#FF3D6B",
  review:      "#FFB800",
  done:        "#00FF88",
};

// ── Zoom ──────────────────────────────────────────────────────────────────────
type ZoomLevel = "week" | "month";
const DAY_PX: Record<ZoomLevel, number> = { week: 16, month: 5 };

// ── Date helpers ──────────────────────────────────────────────────────────────
function sod(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(+d + n * MS_DAY);
}
function diffDays(a: Date, b: Date): number {
  return Math.round((+sod(a) - +sod(b)) / MS_DAY);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TimelineView({ projectId }: { projectId: string }) {
  const tasks      = useProjectStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const deps       = useProjectStore((s) => s.dependencies[projectId] ?? EMPTY_DEPS);
  const loading    = useProjectStore((s) => s.tasksLoading);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const fetchDeps  = useProjectStore((s) => s.fetchDependencies);

  const [zoom, setZoom]               = useState<ZoomLevel>("week");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen]   = useState(false);

  useEffect(() => {
    void fetchTasks(projectId);
    void fetchDeps(projectId);
  }, [projectId, fetchTasks, fetchDeps]);

  // Keep detail drawer synced with store updates
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  const today       = useMemo(() => sod(new Date()), []);
  const scheduled   = useMemo(() => tasks.filter((t) => !!t.dueDate), [tasks]);
  const unscheduled = useMemo(() => tasks.filter((t) => !t.dueDate), [tasks]);

  // ── Date range ────────────────────────────────────────────────────────────

  const rangeStart = useMemo(() => {
    if (scheduled.length === 0) return addDays(today, -PAD_S);
    const pts = [
      today,
      ...scheduled.flatMap((t) => [sod(new Date(t.createdAt)), sod(new Date(t.dueDate!))]),
    ];
    return addDays(sod(new Date(Math.min(...pts.map(Number)))), -PAD_S);
  }, [scheduled, today]);

  const rangeEnd = useMemo(() => {
    if (scheduled.length === 0) return addDays(today, PAD_E);
    const pts = [today, ...scheduled.map((t) => sod(new Date(t.dueDate!)))];
    return addDays(sod(new Date(Math.max(...pts.map(Number)))), PAD_E);
  }, [scheduled, today]);

  const dayPx        = DAY_PX[zoom];
  const totalDays    = Math.ceil(diffDays(rangeEnd, rangeStart));
  const canvasWidth  = totalDays * dayPx;
  const todayX       = diffDays(today, rangeStart) * dayPx;

  // ── Header cells ──────────────────────────────────────────────────────────

  const headerCells = useMemo(() => {
    const cells: { label: string; x: number; w: number; isToday: boolean }[] = [];

    if (zoom === "week") {
      const todayOffset = diffDays(today, rangeStart);
      for (let i = 0; i < totalDays; i += 7) {
        cells.push({
          label:   addDays(rangeStart, i).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          x:       i * dayPx,
          w:       7 * dayPx,
          isToday: todayOffset >= i && todayOffset < i + 7,
        });
      }
    } else {
      // month
      let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (+d <= +rangeEnd) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const xOff = diffDays(d, rangeStart) * dayPx;
        cells.push({
          label:   d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          x:       Math.max(0, xOff),
          w:       daysInMonth * dayPx,
          isToday: today.getMonth() === d.getMonth() && today.getFullYear() === d.getFullYear(),
        });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
    }

    return cells;
  }, [zoom, totalDays, dayPx, rangeStart, rangeEnd, today]);

  // ── Groups & row positions ────────────────────────────────────────────────

  const groups = useMemo(
    () =>
      TASK_STATUSES
        .map((s) => ({ status: s, tasks: scheduled.filter((t) => t.status === s) }))
        .filter((g) => g.tasks.length > 0),
    [scheduled],
  );

  // Y center of each scheduled task row (for SVG dependency arrows)
  const rowCenterY = useMemo(() => {
    const map = new Map<string, number>();
    let y = 0;
    for (const g of groups) {
      y += GROUP_H;
      for (const t of g.tasks) { map.set(t.id, y + ROW_H / 2); y += ROW_H; }
    }
    return map;
  }, [groups]);

  let contentH = 0;
  for (const g of groups) contentH += GROUP_H + g.tasks.length * ROW_H;
  if (unscheduled.length > 0) contentH += GROUP_H + unscheduled.length * ROW_H;

  // ── Bar geometry ──────────────────────────────────────────────────────────

  const barGeo = useCallback(
    (task: Task): { x: number; w: number } | null => {
      if (!task.dueDate) return null;
      const due     = sod(new Date(task.dueDate));
      const created = sod(new Date(task.createdAt));
      const start   = created < rangeStart ? rangeStart : created;
      const x = diffDays(start, rangeStart) * dayPx;
      const w = Math.max(dayPx, (diffDays(due, start) + 1) * dayPx);
      return { x, w };
    },
    [rangeStart, dayPx],
  );

  const openTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  // ── Loading / empty states ─────────────────────────────────────────────────

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      </div>
    );
  }

  if (!loading && tasks.length === 0) {
    return (
      <EmptyState message="No tasks yet. Create some tasks to see the timeline." />
    );
  }

  if (!loading && scheduled.length === 0) {
    return (
      <EmptyState message="Add due dates to tasks to see them on the timeline." />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex h-full flex-col gap-3">

        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary/70" />
            <span className="font-medium text-foreground">Timeline</span>
            <span className="text-border">·</span>
            <span>{scheduled.length} scheduled</span>
            {unscheduled.length > 0 && (
              <span className="text-muted-foreground/50">
                · {unscheduled.length} unscheduled
              </span>
            )}
          </div>

          {/* Zoom toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/40 p-0.5">
            {(["week", "month"] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition",
                  zoom === z
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {z === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>

        {/* Gantt scroll container — scrolls both axes */}
        <div className="flex-1 overflow-auto rounded-xl border border-border">
          <div style={{ minWidth: LABEL_W + canvasWidth }}>

            {/* ── Sticky date header ─────────────────────────────────────── */}
            <div
              className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur-sm"
              style={{ height: HEADER_H }}
            >
              {/* Top-left corner */}
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center border-r border-border bg-background/95 px-5"
                style={{ width: LABEL_W }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Task
                </span>
              </div>

              {/* Week / month labels */}
              <div className="relative flex-1 overflow-hidden" style={{ height: HEADER_H }}>
                {headerCells.map((cell, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute inset-y-0 flex items-center overflow-hidden border-r border-border/20 pl-2.5 text-[11px]",
                      cell.isToday ? "font-semibold text-primary" : "text-muted-foreground",
                    )}
                    style={{ left: cell.x, width: cell.w }}
                  >
                    {cell.label}
                  </div>
                ))}

                {/* Today tick in header */}
                <div
                  className="pointer-events-none absolute inset-y-0 w-[2px]"
                  style={{
                    left:       todayX,
                    background: "linear-gradient(to bottom, #FF3D6B, #6C63FF)",
                    opacity:    0.85,
                  }}
                />
              </div>
            </div>

            {/* ── Content area ───────────────────────────────────────────── */}
            <div className="relative" style={{ minHeight: contentH }}>

              {/* Alternating week column shading */}
              {zoom === "week" &&
                Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute inset-y-0"
                    style={{
                      left:            LABEL_W + i * 7 * dayPx,
                      width:           7 * dayPx,
                      backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                    }}
                  />
                ))}

              {/* Status groups */}
              {groups.map(({ status, tasks: gt }) => {
                const color = STATUS_COLORS[status];
                return (
                  <div key={status}>
                    {/* Group header */}
                    <div className="flex border-b border-border/30" style={{ height: GROUP_H }}>
                      <div
                        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border px-5"
                        style={{ width: LABEL_W, backgroundColor: `${color}18` }}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/40">
                          {gt.length}
                        </span>
                      </div>
                      <div className="flex-1" style={{ backgroundColor: `${color}07` }} />
                    </div>

                    {/* Task rows */}
                    {gt.map((task) => {
                      const geo = barGeo(task);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center border-b border-border/20 transition-colors hover:bg-primary/[0.03]"
                          style={{ height: ROW_H }}
                        >
                          {/* Sticky left label */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => openTask(task)}
                            onKeyDown={(e) => e.key === "Enter" && openTask(task)}
                            className="sticky left-0 z-10 flex h-full shrink-0 cursor-pointer items-center gap-2.5 border-r border-border bg-background/95 px-5 transition-colors hover:bg-primary/5"
                            style={{ width: LABEL_W }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate text-xs font-medium">{task.title}</span>
                            {task.estimatedHours ? (
                              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/40">
                                {task.estimatedHours}h
                              </span>
                            ) : null}
                          </div>

                          {/* Bar canvas */}
                          <div className="relative h-full flex-1">
                            {/* Today hairline */}
                            <div
                              className="pointer-events-none absolute inset-y-0 w-[1px]"
                              style={{
                                left:       todayX,
                                background: "linear-gradient(to bottom, #FF3D6B55, #6C63FF55)",
                              }}
                            />

                            {/* Task bar */}
                            {geo && (
                              <div
                                role="button"
                                tabIndex={-1}
                                onClick={() => openTask(task)}
                                title={task.title}
                                className="absolute top-1/2 h-7 -translate-y-1/2 cursor-pointer rounded-md border transition-opacity hover:opacity-80"
                                style={{
                                  left:            geo.x,
                                  width:           geo.w,
                                  backgroundColor: `${color}22`,
                                  borderColor:     color,
                                  borderLeftWidth: "3px",
                                }}
                              >
                                {geo.w > 52 && (
                                  <span
                                    className="block truncate pl-2 pr-1 text-[10px] font-medium leading-7"
                                    style={{ color }}
                                  >
                                    {task.title}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Unscheduled section */}
              {unscheduled.length > 0 && (
                <div>
                  <div className="flex border-b border-border/30" style={{ height: GROUP_H }}>
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-surface/30 px-5"
                      style={{ width: LABEL_W }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full border border-border/60" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Unscheduled
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground/30">
                        {unscheduled.length}
                      </span>
                    </div>
                    <div className="flex-1 bg-surface/5" />
                  </div>

                  {unscheduled.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center border-b border-border/20 transition-colors hover:bg-primary/[0.03]"
                      style={{ height: ROW_H }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openTask(task)}
                        onKeyDown={(e) => e.key === "Enter" && openTask(task)}
                        className="sticky left-0 z-10 flex h-full shrink-0 cursor-pointer items-center gap-2.5 border-r border-border bg-background/95 px-5 transition-colors hover:bg-primary/5"
                        style={{ width: LABEL_W }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[task.status] }}
                        />
                        <span className="truncate text-xs font-medium text-muted-foreground/70">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex h-full flex-1 items-center px-5">
                        <span className="select-none text-[11px] italic text-muted-foreground/25">
                          No due date
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── SVG overlay: today column + dependency arrows ──────────── */}
              <svg
                className="pointer-events-none absolute left-0 top-0"
                style={{
                  width:    LABEL_W + canvasWidth,
                  height:   contentH,
                  zIndex:   5,
                  overflow: "visible",
                }}
              >
                <defs>
                  <linearGradient id="today-g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#FF3D6B" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#6C63FF" stopOpacity="0.75" />
                  </linearGradient>
                  <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#6C63FF" fillOpacity="0.45" />
                  </marker>
                </defs>

                {/* Subtle today column highlight */}
                <rect
                  x={LABEL_W + todayX}
                  y={0}
                  width={Math.max(dayPx, 2)}
                  height={contentH}
                  fill="#6C63FF"
                  fillOpacity="0.04"
                />

                {/* Today vertical line */}
                <line
                  x1={LABEL_W + todayX + 1}
                  y1={0}
                  x2={LABEL_W + todayX + 1}
                  y2={contentH}
                  stroke="url(#today-g)"
                  strokeWidth="1.5"
                />

                {/* Dependency arrows (blocks type only) */}
                {deps
                  .filter((d) => d.type === "blocks")
                  .map((dep) => {
                    const src  = tasks.find((t) => t.id === dep.sourceTaskId);
                    const tgt  = tasks.find((t) => t.id === dep.targetTaskId);
                    const srcY = rowCenterY.get(dep.sourceTaskId);
                    const tgtY = rowCenterY.get(dep.targetTaskId);
                    if (!src?.dueDate || !tgt?.dueDate || !srcY || !tgtY) return null;
                    const sg = barGeo(src);
                    const tg = barGeo(tgt);
                    if (!sg || !tg) return null;
                    const x1  = LABEL_W + sg.x + sg.w;
                    const x2  = LABEL_W + tg.x;
                    const cpx = (x1 + x2) / 2;
                    return (
                      <path
                        key={dep.id}
                        d={`M ${x1} ${srcY} C ${cpx} ${srcY} ${cpx} ${tgtY} ${x2} ${tgtY}`}
                        fill="none"
                        stroke="#6C63FF"
                        strokeWidth="1.5"
                        strokeOpacity="0.30"
                        markerEnd="url(#dep-arrow)"
                      />
                    );
                  })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <TaskDetail
        task={selectedTask}
        projectId={projectId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedTask(null);
        }}
      />
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <CalendarDays className="h-10 w-10 text-muted-foreground/20" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
