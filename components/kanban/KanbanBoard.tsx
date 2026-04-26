"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Inbox } from "lucide-react";
import type { Task, TaskStatus } from "@/types";
import { STATUS_LABELS, TASK_STATUSES, WIP_LIMITS } from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCreator } from "@/components/tasks/TaskCreator";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

const EMPTY_TASKS: Task[] = [];

// PRD §5.2 / §7.2: Kanban with columns Backlog | Todo | In Progress | Blocked | Review | Done.
// Uses @dnd-kit/sortable for within-column ordering and cross-column moves.
// Status is updated optimistically in the store and reverted on API failure.
export function KanbanBoard({ projectId }: { projectId: string }) {
  const tasks      = useProjectStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const loading    = useProjectStore((s) => s.tasksLoading);
  const error      = useProjectStore((s) => s.tasksError);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const moveTask   = useProjectStore((s) => s.moveTask);

  // localTasks is a mutable snapshot held during an active drag so the board
  // responds immediately as the card crosses column boundaries.  It is cleared
  // (reverted to store state) on dragEnd / dragCancel.
  const [activeTask, setActiveTask]   = useState<Task | null>(null);
  const [localTasks, setLocalTasks]   = useState<Task[] | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen]   = useState(false);

  const displayTasks = localTasks ?? tasks;

  useEffect(() => {
    void fetchTasks(projectId);
  }, [projectId, fetchTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 8 px dead zone so a normal click never activates drag.
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [], todo: [], in_progress: [], blocked: [], review: [], done: [],
    };
    for (const t of displayTasks) map[t.status].push(t);
    return map;
  }, [displayTasks]);

  const openTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  // Keep the detail panel up-to-date when the store refreshes.
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === String(active.id));
    setActiveTask(task ?? null);
    setLocalTasks([...tasks]);
  }, [tasks]);

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) return;
    const draggedId = String(active.id);
    const overId    = String(over.id);

    // Resolve the target column: overId is either a status string (column
    // droppable) or a task id (sortable within a column).
    let targetStatus: TaskStatus | null = null;
    if ((TASK_STATUSES as string[]).includes(overId)) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = (localTasks ?? tasks).find((t) => t.id === overId);
      if (overTask) targetStatus = overTask.status;
    }
    if (!targetStatus) return;

    setLocalTasks((prev) => {
      const list = prev ?? tasks;
      const src  = list.find((t) => t.id === draggedId);
      if (!src || src.status === targetStatus) return prev;
      return list.map((t) => (t.id === draggedId ? { ...t, status: targetStatus! } : t));
    });
  }, [localTasks, tasks]);

  const onDragEnd = useCallback(({ active }: DragEndEvent) => {
    const snapshot = localTasks;
    setActiveTask(null);
    setLocalTasks(null);

    const draggedId = String(active.id);
    const original  = tasks.find((t) => t.id === draggedId);
    const updated   = snapshot?.find((t) => t.id === draggedId);

    if (!original || !updated || original.status === updated.status) return;

    moveTask(projectId, draggedId, updated.status).catch((err: unknown) => {
      console.error("[kanban] moveTask failed:", err);
      alert(err instanceof Error ? err.message : "Failed to move task");
    });
  }, [localTasks, tasks, projectId, moveTask]);

  const onDragCancel = useCallback(() => {
    setActiveTask(null);
    setLocalTasks(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (error && tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="h-full overflow-x-auto">
          <div className="flex gap-3 h-full min-w-max pb-2">
            {TASK_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={byStatus[status]}
                projectId={projectId}
                onOpen={openTask}
                loading={loading && tasks.length === 0}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} dragging /> : null}
        </DragOverlay>
      </DndContext>

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

// ── Column ────────────────────────────────────────────────────────────────────

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  onOpen: (task: Task) => void;
  loading: boolean;
}

function Column({ status, tasks, projectId, onOpen, loading }: ColumnProps) {
  // useDroppable makes the column a valid drop target when hovering over empty
  // space (or when SortableContext has no items).
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const limit     = WIP_LIMITS[status];
  const overLimit = typeof limit === "number" && tasks.length > limit;
  const itemIds   = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-xl border bg-surface/40 p-3 flex flex-col transition-colors",
        isOver ? "border-primary/60 bg-surface/70" : "border-border",
        overLimit && "border-destructive/60",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          {STATUS_LABELS[status]}
          {overLimit ? (
            <AlertTriangle
              className="w-3.5 h-3.5 text-destructive"
              aria-label={`Over WIP limit (${limit})`}
            />
          ) : null}
        </h3>
        <span
          className={cn(
            "min-w-[1.75rem] text-center rounded-full px-2 py-0.5 text-xs font-mono",
            overLimit
              ? "bg-destructive/15 text-destructive"
              : "bg-background/60 text-muted-foreground",
          )}
        >
          {typeof limit === "number" ? `${tasks.length}/${limit}` : tasks.length}
        </span>
      </div>

      {/* Cards area */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto pr-0.5 min-h-[72px]">
          {loading ? (
            <p className="text-xs text-muted-foreground animate-pulse px-1">Loading…</p>
          ) : tasks.length === 0 ? (
            <div className="flex h-full min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 text-muted-foreground/40">
              <Inbox className="h-4 w-4" />
              <p className="text-[11px]">Drop tasks here</p>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableCard key={task.id} task={task} onOpen={onOpen} />
            ))
          )}
        </div>
      </SortableContext>

      {/* Quick-add */}
      <div className="pt-2 border-t border-border/50 mt-2 shrink-0">
        <TaskCreator projectId={projectId} status={status} />
      </div>
    </div>
  );
}

// ── Sortable card wrapper ─────────────────────────────────────────────────────

function SortableCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // The outer div owns the drag listeners; the inner TaskCard button owns
    // the click.  With a distance:8 activation constraint, a simple click
    // never activates drag, so both interactions work independently.
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-40")}
    >
      <TaskCard task={task} onOpen={onOpen} dragging={isDragging} />
    </div>
  );
}
