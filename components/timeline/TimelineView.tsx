"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import type { CascadeImpact, Task, TaskDependency, TaskStatus } from "@/types";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { CascadeModal } from "@/components/ai/CascadeModal";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

// ── Layout constants ───────────────────────────────────────────────────────────
const ROW_H    = 44;   // px per task row
const GROUP_H  = 34;   // px per status group header
const HEADER_H = 52;   // px for the sticky date header
const LABEL_W  = 224;  // px for the fixed left label column

const MS_PER_DAY = 86_400_000;
const PAD_START  = 14; // days of padding before earliest event
const PAD_END    = 30; // days of padding after latest event

type ZoomLevel = "day" | "week" | "month";

// Pixels per day at each zoom level
const DAY_PX: Record<ZoomLevel, number> = { day: 48, week: 14, month: 4 };

const STATUS_COLORS: Record<TaskStatus, { bar: string; glow: string }> = {
  backlog:     { bar: "#4a4a5a", glow: "#4a4a5a" },
  todo:        { bar: "#6e6e88", glow: "#6e6e88" },
  in_progress: { bar: "#6C63FF", glow: "#6C63FF" },
  blocked:     { bar: "#FF8C3D", glow: "#FF8C3D" },
  review:      { bar: "#FFD03D", glow: "#FFD03D" },
  done:        { bar: "#00FF88", glow: "#00FF88" },
};

// ── Date utilities ─────────────────────────────────────────────────────────────

function sod(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(+d + n * MS_PER_DAY);
}
function diffDays(a: Date, b: Date): number {
  return (+sod(a) - +sod(b)) / MS_PER_DAY;
}
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Local types ────────────────────────────────────────────────────────────────

interface DragInfo {
  taskId:       string;
  edge:         "right" | "body";
  startX:       number;
  origDueDays:  number;  // days from rangeStart at drag start
  barDays:      number;  // bar width in days (clamp for right-resize)
  moved:        boolean;
}

interface PendingApply {
  taskId:      string;
  newDueDate:  string; // YYYY-MM-DD
  origDueDate: string; // YYYY-MM-DD
}

interface HeaderCell {
  label:   string;
  x:       number;
  w:       number;
  isToday: boolean;
}

interface BarGeo { x: number; w: number }

// ── TimelineView ───────────────────────────────────────────────────────────────

export function TimelineView({ projectId }: { projectId: string }) {
  const tasks      = useProjectStore((s) => s.tasks[projectId] ?? []);
  const deps       = useProjectStore((s) => s.dependencies[projectId] ?? []);
  const loading    = useProjectStore((s) => s.tasksLoading);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const fetchDeps  = useProjectStore((s) => s.fetchDependencies);
  const updateTask = useProjectStore((s) => s.updateTask);

  const [zoom, setZoom]                     = useState<ZoomLevel>("week");
  const [selectedTask, setSelectedTask]     = useState<Task | null>(null);
  const [detailOpen, setDetailOpen]         = useState(false);
  const [cascadeOpen, setCascadeOpen]       = useState(false);
  const [cascadeImpact, setCascadeImpact]   = useState<CascadeImpact | null>(null);
  const [pendingApply, setPendingApply]     = useState<PendingApply | null>(null);

  // Drag: mutable ref for in-flight drag state, state for visual preview
  const dragRef    = useRef<DragInfo | null>(null);
  const previewRef = useRef<{ taskId: string; ymd: string } | null>(null);
  const [preview, setPreview] = useState<{ taskId: string; ymd: string } | null>(null);

  // Stable context bag — updated on every render, read by global event handlers
  const ctxRef = useRef({
    dragRef,
    previewRef,
    setPreview,
    setSelectedTask,
    setDetailOpen,
    setCascadeOpen,
    setCascadeImpact,
    setPendingApply,
    dayPx:      DAY_PX.week as number,
    rangeStart: new Date() as Date,
    tasks:      [] as Task[],
    projectId:  projectId as string,
    updateTask,
  });
  // Synchronize every render (state setters are stable so they never need updating)
  ctxRef.current.dayPx     = DAY_PX[zoom];
  ctxRef.current.tasks     = tasks;
  ctxRef.current.projectId = projectId;
  ctxRef.current.updateTask = updateTask;

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchTasks(projectId);
    void fetchDeps(projectId);
  }, [projectId, fetchTasks, fetchDeps]);

  // Keep open TaskDetail in sync when store refreshes the task
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  // ── Date range ────────────────────────────────────────────────────────────

  const today = useMemo(() => sod(new Date()), []);

  const topLevel    = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);
  const scheduled   = useMemo(() => topLevel.filter((t) => !!t.dueDate), [topLevel]);
  const unscheduled = useMemo(() => topLevel.filter((t) => !t.dueDate), [topLevel]);

  const rangeStart = useMemo(() => {
    if (scheduled.length === 0) return addDays(today, -PAD_START);
    const pts = scheduled.flatMap((t) => [
      sod(new Date(t.createdAt)),
      sod(new Date(t.dueDate!)),
    ]);
    pts.push(today);
    return addDays(sod(new Date(Math.min(...pts.map(Number)))), -PAD_START);
  }, [scheduled, today]);

  const rangeEnd = useMemo(() => {
    if (scheduled.length === 0) return addDays(today, PAD_END);
    const pts = scheduled.map((t) => sod(new Date(t.dueDate!)));
    pts.push(today);
    return addDays(sod(new Date(Math.max(...pts.map(Number)))), PAD_END);
  }, [scheduled, today]);

  // Keep rangeStart in ctxRef (needed by drag handlers)
  ctxRef.current.rangeStart = rangeStart;

  const dayPx        = DAY_PX[zoom];
  const totalDays    = Math.ceil(diffDays(rangeEnd, rangeStart));
  const totalWidthPx = totalDays * dayPx;
  const todayX       = diffDays(today, rangeStart) * dayPx;

  function dateToX(d: Date): number {
    return diffDays(d, rangeStart) * dayPx;
  }

  // ── Bar geometry ──────────────────────────────────────────────────────────
  // Returns { x, w } in px relative to the bars area (left edge = 0)

  function getBarGeo(task: Task): BarGeo | null {
    const dueDateStr = preview?.taskId === task.id ? preview.ymd : task.dueDate;
    if (!dueDateStr) return null;
    const dueDate  = sod(new Date(dueDateStr));
    let startDate  = sod(new Date(task.createdAt));

    // Body drag: shift the start date by the same delta so the bar moves as a unit
    if (
      preview?.taskId === task.id &&
      dragRef.current?.edge === "body" &&
      task.dueDate
    ) {
      const delta = diffDays(dueDate, sod(new Date(task.dueDate)));
      startDate   = addDays(startDate, delta);
    }

    const clamped = startDate < rangeStart ? rangeStart : startDate;
    const x = dateToX(clamped);
    const w = Math.max(dayPx, dateToX(dueDate) + dayPx - x);
    return { x, w };
  }

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groups = useMemo(
    () =>
      TASK_STATUSES
        .map((s) => ({ status: s, tasks: scheduled.filter((t) => t.status === s) }))
        .filter((g) => g.tasks.length > 0),
    [scheduled],
  );

  // Center Y of each scheduled task row (relative to content div top, below header)
  const rowCenterY = useMemo(() => {
    const m = new Map<string, number>();
    let y = 0;
    for (const g of groups) {
      y += GROUP_H;
      for (const t of g.tasks) {
        m.set(t.id, y + ROW_H / 2);
        y += ROW_H;
      }
    }
    return m;
  }, [groups]);

  let contentHeight = 0;
  for (const g of groups) contentHeight += GROUP_H + g.tasks.length * ROW_H;
  if (unscheduled.length > 0) contentHeight += GROUP_H + unscheduled.length * ROW_H;

  // ── Header cells ──────────────────────────────────────────────────────────

  const headerCells = useMemo((): HeaderCell[] => {
    const cells: HeaderCell[] = [];
    if (zoom === "day") {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i);
        cells.push({
          label:   d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
          x:       i * dayPx,
          w:       dayPx,
          isToday: +sod(d) === +today,
        });
      }
    } else if (zoom === "week") {
      for (let i = 0; i < totalDays; i += 7) {
        const d       = addDays(rangeStart, i);
        const todayOff = diffDays(today, rangeStart);
        cells.push({
          label:   d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          x:       i * dayPx,
          w:       7 * dayPx,
          isToday: todayOff >= i && todayOff < i + 7,
        });
      }
    } else {
      // month
      let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      while (d <= rangeEnd) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        cells.push({
          label:   d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          x:       Math.max(0, diffDays(d, rangeStart) * dayPx),
          w:       daysInMonth * dayPx,
          isToday: today.getMonth() === d.getMonth() && today.getFullYear() === d.getFullYear(),
        });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
    }
    return cells;
  }, [zoom, totalDays, dayPx, rangeStart, rangeEnd, today]);

  // ── Global mouse drag handlers ────────────────────────────────────────────
  // Empty-dep effect; all mutable state is accessed through ctxRef.

  useEffect(() => {
    const ctx = ctxRef;

    function onMouseMove(e: MouseEvent) {
      const drag = ctx.current.dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      if (Math.abs(dx) > 4) drag.moved = true;
      if (!drag.moved) return;

      const { dayPx: dpx, rangeStart: rs } = ctx.current;
      const daysDelta = Math.round(dx / dpx);
      let newDueDays  = drag.origDueDays + daysDelta;

      if (drag.edge === "right") {
        // Prevent shrinking below 1 day
        newDueDays = Math.max(drag.origDueDays - drag.barDays + 1, newDueDays);
      }

      const ymd = toYMD(addDays(rs, newDueDays));
      ctx.current.previewRef.current = { taskId: drag.taskId, ymd };
      ctx.current.setPreview({ taskId: drag.taskId, ymd });
      document.body.style.cursor = drag.edge === "right" ? "ew-resize" : "grabbing";
    }

    async function onMouseUp() {
      document.body.style.cursor = "";
      const drag = ctx.current.dragRef.current;
      if (!drag) return;
      const pv = ctx.current.previewRef.current;
      ctx.current.dragRef.current    = null;
      ctx.current.previewRef.current = null;

      const {
        tasks: ts, projectId: pid, updateTask: upd,
        setPreview: sp, setSelectedTask: sst, setDetailOpen: sdo,
        setCascadeOpen: sco, setCascadeImpact: sci, setPendingApply: spa,
      } = ctx.current;

      // No movement → treat as click → open TaskDetail
      if (!drag.moved) {
        sp(null);
        const task = ts.find((t) => t.id === drag.taskId);
        if (task) { sst(task); sdo(true); }
        return;
      }

      if (!pv) { sp(null); return; }
      const task    = ts.find((t) => t.id === drag.taskId);
      const origYmd = task?.dueDate?.slice(0, 10) ?? "";
      if (!task || pv.ymd === origYmd) { sp(null); return; }

      // Check cascade impact
      try {
        const res = await fetch("/api/ai/cascade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            changedTaskId: drag.taskId,
            newDueDate:    pv.ymd,
            projectId:     pid,
          }),
        });
        if (res.ok) {
          const impact: CascadeImpact = await res.json();
          spa({ taskId: drag.taskId, newDueDate: pv.ymd, origDueDate: origYmd });
          if (impact.affected.length > 0) {
            sci(impact);
            sco(true);
            return; // keep preview visible while modal is open
          }
        }
      } catch { /* best-effort: fall through to direct apply */ }

      // No downstream impact — apply immediately
      await upd(pid, drag.taskId, { dueDate: new Date(pv.ymd).toISOString() });
      sp(null);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    };
  }, []); // stable: all live state read via ctxRef

  // ── Cascade handlers ──────────────────────────────────────────────────────

  const handleCascadeAccept = async () => {
    if (!cascadeImpact || !pendingApply) return;
    const { taskId, newDueDate } = pendingApply;
    await updateTask(projectId, taskId, { dueDate: new Date(newDueDate).toISOString() });
    if (cascadeImpact.rebalancedTasks?.length) {
      for (const { taskId: tid, suggestedDueDate } of cascadeImpact.rebalancedTasks) {
        if (tid === taskId) continue;
        await updateTask(projectId, tid, { dueDate: new Date(suggestedDueDate).toISOString() });
      }
    } else {
      for (const { taskId: tid, delayDays } of cascadeImpact.affected) {
        const t = tasks.find((x) => x.id === tid);
        if (t?.dueDate) {
          const shifted = new Date(new Date(t.dueDate).getTime() + delayDays * MS_PER_DAY);
          await updateTask(projectId, tid, { dueDate: shifted.toISOString() });
        }
      }
    }
    setCascadeOpen(false);
    setPreview(null);
  };

  const handleCascadeRevert = () => {
    setCascadeOpen(false);
    setCascadeImpact(null);
    setPendingApply(null);
    setPreview(null);
  };

  const handleCascadeRebalance = async (): Promise<CascadeImpact> => {
    if (!pendingApply) throw new Error("No pending drag");
    const res = await fetch("/api/ai/cascade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        changedTaskId: pendingApply.taskId,
        newDueDate:    pendingApply.newDueDate,
        projectId,
        rebalance:     true,
      }),
    });
    if (!res.ok) throw new Error("Rebalance failed");
    const updated: CascadeImpact = await res.json();
    setCascadeImpact(updated);
    return updated;
  };

  // ── Helper: start a drag ──────────────────────────────────────────────────

  function startDrag(e: React.MouseEvent, task: Task, edge: "right" | "body") {
    e.preventDefault();
    const dueDateStr = preview?.taskId === task.id ? preview.ymd : task.dueDate!;
    const due        = sod(new Date(dueDateStr));
    const start      = sod(new Date(task.createdAt));
    const clamped    = start < rangeStart ? rangeStart : start;
    dragRef.current  = {
      taskId:      task.id,
      edge,
      startX:      e.clientX,
      origDueDays: diffDays(due, rangeStart),
      barDays:     Math.max(1, diffDays(due, clamped) + 1),
      moved:       false,
    };
  }

  // ── Loading / empty states ─────────────────────────────────────────────────

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading timeline…
      </div>
    );
  }
  if (!loading && topLevel.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-8 w-8 opacity-30" />
        <p>No tasks yet. Create some tasks to see the timeline.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Timeline</h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/40 p-0.5">
          {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition",
                zoom === z
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt scroll container */}
      <div
        className="overflow-auto rounded-xl border border-border"
        style={{ maxHeight: "calc(100vh - 10rem)" }}
      >
        <div style={{ minWidth: LABEL_W + totalWidthPx }}>

          {/* ── Sticky date header ── */}
          <div
            className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur-sm"
            style={{ height: HEADER_H }}
          >
            {/* Corner label */}
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center gap-2 border-r border-border bg-background/95 px-4"
              style={{ width: LABEL_W }}
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Task</span>
            </div>

            {/* Date cells */}
            <div className="relative flex-1 overflow-hidden" style={{ height: HEADER_H }}>
              {headerCells.map((cell, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute bottom-0 top-0 flex items-end overflow-hidden border-r border-border/20 pb-2 pl-2 text-[11px]",
                    cell.isToday
                      ? "font-semibold text-[#6C63FF]"
                      : "text-muted-foreground",
                  )}
                  style={{ left: cell.x, width: cell.w }}
                >
                  {cell.label}
                </div>
              ))}
              {/* Today marker in header */}
              <div
                className="pointer-events-none absolute bottom-0 top-0 w-px opacity-80"
                style={{ left: todayX, backgroundColor: "#6C63FF" }}
              />
            </div>
          </div>

          {/* ── Content area ── */}
          <div className="relative" style={{ minHeight: contentHeight }}>

            {/* Status groups */}
            {groups.map(({ status, tasks: gt }) => {
              const c = STATUS_COLORS[status];
              return (
                <div key={status}>
                  {/* Group header row */}
                  <div
                    className="flex border-b border-border/30"
                    style={{ height: GROUP_H }}
                  >
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border px-4"
                      style={{ width: LABEL_W, backgroundColor: `${c.bar}18` }}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: c.bar }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground/50">{gt.length}</span>
                    </div>
                    <div className="flex-1" style={{ backgroundColor: `${c.bar}08` }} />
                  </div>

                  {/* Task rows */}
                  {gt.map((task) => {
                    const geo         = getBarGeo(task);
                    const isDragging  = dragRef.current?.taskId === task.id;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center border-b border-border/20 transition-colors hover:bg-primary/5"
                        style={{ height: ROW_H }}
                      >
                        {/* Label (sticky) */}
                        <div
                          className="sticky left-0 z-10 flex h-full shrink-0 cursor-pointer items-center gap-2 border-r border-border bg-background/95 px-4 transition-colors hover:bg-primary/5"
                          style={{ width: LABEL_W }}
                          onClick={() => { setSelectedTask(task); setDetailOpen(true); }}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.bar }}
                          />
                          <span className="truncate text-xs font-medium">{task.title}</span>
                        </div>

                        {/* Bar area */}
                        <div className="relative h-full flex-1">
                          {/* Per-row today shading line */}
                          <div
                            className="pointer-events-none absolute inset-y-0 w-px opacity-15"
                            style={{ left: todayX, backgroundColor: "#6C63FF" }}
                          />

                          {geo && (
                            <div
                              className={cn(
                                "absolute top-1/2 flex h-7 -translate-y-1/2 select-none items-center rounded-md border",
                                isDragging ? "cursor-grabbing" : "cursor-grab",
                              )}
                              style={{
                                left:            geo.x,
                                width:           geo.w,
                                backgroundColor: `${c.bar}22`,
                                borderColor:     c.bar,
                                boxShadow:       isDragging
                                  ? `0 0 0 2px ${c.bar}50, 0 4px 16px ${c.bar}25`
                                  : undefined,
                              }}
                              onMouseDown={(e) => {
                                // Right resize handle intercepts its own mousedown
                                if ((e.target as HTMLElement).dataset.edge === "right") return;
                                startDrag(e, task, "body");
                              }}
                            >
                              <span
                                className="flex-1 truncate px-2 text-[10px] font-medium"
                                style={{ color: c.bar }}
                              >
                                {task.title}
                              </span>

                              {/* Right-edge resize handle */}
                              <div
                                className="absolute right-0 top-0 flex h-full w-3 cursor-ew-resize items-center justify-center gap-px"
                                data-edge="right"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  startDrag(e, task, "right");
                                }}
                              >
                                <div
                                  className="h-3 w-px rounded-full opacity-60"
                                  style={{ backgroundColor: c.bar }}
                                />
                                <div
                                  className="h-3 w-px rounded-full opacity-35"
                                  style={{ backgroundColor: c.bar }}
                                />
                              </div>
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
                <div
                  className="flex border-b border-border/30"
                  style={{ height: GROUP_H }}
                >
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-surface/40 px-4"
                    style={{ width: LABEL_W }}
                  >
                    <Calendar className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Unscheduled
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/40">
                      {unscheduled.length}
                    </span>
                  </div>
                  <div className="flex-1 bg-surface/10" />
                </div>

                {unscheduled.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center border-b border-border/20 transition-colors hover:bg-primary/5"
                    style={{ height: ROW_H }}
                  >
                    <div
                      className="sticky left-0 z-10 flex h-full shrink-0 cursor-pointer items-center gap-2 border-r border-border bg-background/95 px-4 transition-colors hover:bg-primary/5"
                      style={{ width: LABEL_W }}
                      onClick={() => { setSelectedTask(task); setDetailOpen(true); }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[task.status].bar }}
                      />
                      <span className="truncate text-xs font-medium text-muted-foreground">
                        {task.title}
                      </span>
                    </div>
                    <div className="flex h-full flex-1 items-center px-5">
                      <span className="text-[11px] italic text-muted-foreground/35">
                        No due date — click to add one
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── SVG overlay: today band + dependency arrows ── */}
            <svg
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width:    LABEL_W + totalWidthPx,
                height:   contentHeight,
                zIndex:   2,
                overflow: "visible",
              }}
            >
              <defs>
                <marker
                  id="tl-arrow"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#6C63FF" fillOpacity="0.55" />
                </marker>
              </defs>

              {/* Subtle today column highlight */}
              <rect
                x={LABEL_W + todayX}
                y={0}
                width={Math.max(dayPx, 2)}
                height={contentHeight}
                fill="#6C63FF"
                fillOpacity="0.05"
              />

              {/* Dependency arrows (type === "blocks") */}
              {(deps as TaskDependency[])
                .filter((d) => d.type === "blocks")
                .map((dep) => {
                  const srcTask = tasks.find((t) => t.id === dep.sourceTaskId);
                  const tgtTask = tasks.find((t) => t.id === dep.targetTaskId);
                  const srcY    = rowCenterY.get(dep.sourceTaskId);
                  const tgtY    = rowCenterY.get(dep.targetTaskId);
                  if (!srcY || !tgtY || !srcTask?.dueDate || !tgtTask?.dueDate) return null;
                  const srcGeo = getBarGeo(srcTask);
                  const tgtGeo = getBarGeo(tgtTask);
                  if (!srcGeo || !tgtGeo) return null;

                  const x1  = LABEL_W + srcGeo.x + srcGeo.w;
                  const y1  = srcY;
                  const x2  = LABEL_W + tgtGeo.x;
                  const y2  = tgtY;
                  const cpx = (x1 + x2) / 2;
                  return (
                    <path
                      key={dep.id}
                      d={`M ${x1} ${y1} C ${cpx} ${y1} ${cpx} ${y2} ${x2} ${y2}`}
                      fill="none"
                      stroke="#6C63FF"
                      strokeWidth="1.5"
                      strokeOpacity="0.4"
                      markerEnd="url(#tl-arrow)"
                    />
                  );
                })}
            </svg>

          </div>
        </div>
      </div>

      {/* TaskDetail drawer */}
      <TaskDetail
        task={selectedTask}
        projectId={projectId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedTask(null);
        }}
      />

      {/* Cascade Impact modal */}
      {cascadeImpact && (
        <CascadeModal
          open={cascadeOpen}
          onOpenChange={(open) => { if (!open) handleCascadeRevert(); }}
          impact={cascadeImpact}
          tasks={tasks}
          onAccept={handleCascadeAccept}
          onRevert={handleCascadeRevert}
          onRebalance={handleCascadeRebalance}
        />
      )}
    </>
  );
}
