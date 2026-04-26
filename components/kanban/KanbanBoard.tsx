"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle } from "lucide-react";
import type { Task, TaskStatus } from "@/types";
import { STATUS_LABELS, TASK_STATUSES, WIP_LIMITS } from "@/lib/tasks";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskCreator } from "@/components/tasks/TaskCreator";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

const EMPTY_TASKS: Task[] = [];

// PRD §5.2 / §7.2: Kanban with columns Backlog | Todo | In Progress | Blocked | Review | Done.
// Drag-and-drop via @dnd-kit; status is updated optimistically in the store,
// reverted on API failure.
export function KanbanBoard({ projectId }: { projectId: string }) {
  const tasks = useProjectStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const loading = useProjectStore((s) => s.tasksLoading);
  const error = useProjectStore((s) => s.tasksError);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const moveTask = useProjectStore((s) => s.moveTask);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    void fetchTasks(projectId);
  }, [projectId, fetchTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Bucket tasks by status for rendering.
  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      blocked: [],
      review: [],
      done: [],
    };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  // Keep the open detail panel in sync when the task updates in the store.
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    // Drop targets are column ids; anything else we ignore.
    if (!(TASK_STATUSES as string[]).includes(overId)) return;
    const nextStatus = overId as TaskStatus;
    moveTask(projectId, taskId, nextStatus).catch((err: unknown) => {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to move task");
    });
  };

  if (error && tasks.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="h-full overflow-x-auto">
          <div className="flex gap-4 h-full min-w-max pb-2">
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

function Column({
  status,
  tasks,
  projectId,
  onOpen,
  loading,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  onOpen: (task: Task) => void;
  loading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const limit = WIP_LIMITS[status];
  const overLimit = typeof limit === "number" && tasks.length > limit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-xl border bg-surface/40 p-3 flex flex-col transition",
        isOver ? "border-primary/60 bg-surface/60" : "border-border",
        overLimit && "border-destructive/60",
      )}
    >
      <div className="flex items-center justify-between mb-3">
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
            "text-xs",
            overLimit ? "text-destructive font-mono" : "text-muted-foreground",
          )}
        >
          {typeof limit === "number" ? `${tasks.length}/${limit}` : tasks.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No tasks</p>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} task={task} onOpen={onOpen} />
          ))
        )}
      </div>

      <div className="pt-2 border-t border-border/50 mt-2">
        <TaskCreator projectId={projectId} status={status} />
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onOpen={onOpen} dragging={isDragging} />
    </div>
  );
}
