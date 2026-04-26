"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import { Loader2, GitFork } from "lucide-react";
import type { Task, TaskDependency, TaskStatus } from "@/types";
import { TASK_STATUSES } from "@/lib/tasks";
import { TaskNode, STATUS_COLOR, type TaskNodeData } from "@/components/graph/TaskNode";
import { GraphToolbar } from "@/components/graph/GraphToolbar";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";

// Stable empty-array sentinels for Zustand v5 selectors.
const EMPTY_TASKS: Task[] = [];
const EMPTY_DEPS: TaskDependency[] = [];

// NODE_TYPES must be stable (declared outside the component).
const NODE_TYPES = { task: TaskNode };

export function TaskGraph({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <TaskGraphInner projectId={projectId} />
    </ReactFlowProvider>
  );
}

function TaskGraphInner({ projectId }: { projectId: string }) {
  const tasks        = useProjectStore((s) => s.tasks[projectId] ?? EMPTY_TASKS);
  const deps         = useProjectStore((s) => s.dependencies[projectId] ?? EMPTY_DEPS);
  const loading      = useProjectStore((s) => s.tasksLoading);
  const tasksError   = useProjectStore((s) => s.tasksError);
  const fetchTasks   = useProjectStore((s) => s.fetchTasks);
  const fetchDeps    = useProjectStore((s) => s.fetchDependencies);
  const createDep    = useProjectStore((s) => s.createDependency);
  const deleteDep    = useProjectStore((s) => s.deleteDependency);
  const setPosition  = useProjectStore((s) => s.setTaskPosition);

  const { fitView } = useReactFlow();

  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(
    () => new Set(TASK_STATUSES),
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [nodes, setNodes]               = useState<Node<TaskNodeData>[]>([]);
  const [edges, setEdges]               = useState<Edge[]>([]);

  // Track whether we've ever loaded tasks for this project.
  const hasFetchedRef = useRef(false);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    hasFetchedRef.current = false;
    console.log("[TaskGraph] fetching data for project:", projectId);
    void fetchTasks(projectId);
    void fetchDeps(projectId);
  }, [projectId, fetchTasks, fetchDeps]);

  // ── Debug: log what the store has after each change ───────────────────────
  useEffect(() => {
    console.log(
      `[TaskGraph] store update — tasks: ${tasks.length}, deps: ${deps.length}, loading: ${loading}, error: ${tasksError ?? "none"}`,
    );
    if (tasks.length > 0) {
      console.log("[TaskGraph] first task sample:", tasks[0]);
    }
  }, [tasks, deps, loading, tasksError]);

  // ── Build nodes ────────────────────────────────────────────────────────────
  const dependentCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deps) {
      if (d.type !== "blocks") continue;
      counts[d.sourceTaskId] = (counts[d.sourceTaskId] ?? 0) + 1;
    }
    return counts;
  }, [deps]);

  useEffect(() => {
    const built = buildNodes(tasks, dependentCount, statusFilter);
    console.log(`[TaskGraph] buildNodes → ${built.length} nodes (tasks=${tasks.length})`);
    setNodes(built);
  }, [tasks, dependentCount, statusFilter]);

  useEffect(() => {
    const built = buildEdges(deps, tasks, statusFilter);
    console.log(`[TaskGraph] buildEdges → ${built.length} edges`);
    setEdges(built);
  }, [deps, tasks, statusFilter]);

  // ── Fit view once when nodes first appear ─────────────────────────────────
  const fittedRef = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !fittedRef.current) {
      fittedRef.current = true;
      // Small delay lets React Flow finish its internal layout.
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 80);
    }
    if (nodes.length === 0) fittedRef.current = false;
  }, [nodes.length, fitView]);

  // ── React Flow callbacks ───────────────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange<Node<TaskNodeData>>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const tempId = `tmp-${connection.source}-${connection.target}`;
      setEdges((es) => addEdge({ ...connection, id: tempId }, es));
      try {
        const dep = await createDep(projectId, connection.source, connection.target);
        setEdges((es) =>
          es.map((e) =>
            e.id === tempId
              ? { ...e, id: dep.id, style: edgeStyleForType(dep.type), animated: dep.type === "blocks" }
              : e,
          ),
        );
      } catch (err) {
        setEdges((es) => es.filter((e) => e.id !== tempId));
        alert(err instanceof Error ? err.message : "Failed to create dependency");
      }
    },
    [projectId, createDep],
  );

  const onEdgesDelete = useCallback(
    (removed: Edge[]) => {
      for (const edge of removed) {
        if (edge.id.startsWith("tmp-")) continue;
        void deleteDep(projectId, edge.id).catch(() => {
          void fetchDeps(projectId);
        });
      }
    },
    [projectId, deleteDep, fetchDeps],
  );

  const onNodeDragStop: NodeMouseHandler<Node<TaskNodeData>> = useCallback(
    (_event, node) => {
      void setPosition(projectId, node.id, node.position.x, node.position.y);
    },
    [projectId, setPosition],
  );

  const onNodeClick: NodeMouseHandler<Node<TaskNodeData>> = useCallback((_e, node) => {
    setSelectedTask(node.data.task);
    setDetailOpen(true);
  }, []);

  // Keep the detail panel in sync with the latest store data.
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh && fresh !== selectedTask) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  const toggleStatus = useCallback((status: TaskStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  }, []);

  const resetFilter = useCallback(() => setStatusFilter(new Set(TASK_STATUSES)), []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading graph…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (tasksError && tasks.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-destructive">Failed to load tasks: {tasksError}</p>
        <button
          type="button"
          onClick={() => { void fetchTasks(projectId); }}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface transition"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loading && tasks.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-center px-6">
        <GitFork className="h-12 w-12 text-muted-foreground/30" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">No tasks yet</p>
          <p className="text-sm text-muted-foreground">
            Use the Cortex bar below to generate a plan, or create tasks manually.
          </p>
        </div>
      </div>
    );
  }

  // ── Graph ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="h-full w-full bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2a3a" />
          <MiniMap
            pannable
            zoomable
            maskColor="rgba(10,10,15,0.8)"
            nodeColor={(n) => {
              const data = n.data as TaskNodeData | undefined;
              return data ? STATUS_COLOR[data.task.status] : "#6C63FF";
            }}
            style={{
              background: "rgba(18,18,26,0.8)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
            }}
          />
          <GraphToolbar
            statusFilter={statusFilter}
            onToggleStatus={toggleStatus}
            onReset={resetFilter}
            nodeCount={nodes.filter((n) => !n.hidden).length}
            edgeCount={edges.filter((e) => !e.hidden).length}
          />
        </ReactFlow>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildNodes(
  tasks: Task[],
  dependentCount: Record<string, number>,
  statusFilter: Set<TaskStatus>,
): Node<TaskNodeData>[] {
  return tasks.map((t, i) => {
    // Use stored position when non-zero; fall back to a grid layout.
    const hasStored = (t.positionX ?? 0) !== 0 || (t.positionY ?? 0) !== 0;
    const fallbackX = (i % 5) * 260 + 40;
    const fallbackY = Math.floor(i / 5) * 180 + 40;
    return {
      id: t.id,
      type: "task",
      position: {
        x: hasStored ? t.positionX : fallbackX,
        y: hasStored ? t.positionY : fallbackY,
      },
      data: {
        task: t,
        dependentCount: dependentCount[t.id] ?? 0,
        dimmed: !statusFilter.has(t.status),
      },
      hidden: !statusFilter.has(t.status),
    };
  });
}

function buildEdges(
  deps: TaskDependency[],
  tasks: Task[],
  statusFilter: Set<TaskStatus>,
): Edge[] {
  const visibleIds = new Set(
    tasks.filter((t) => statusFilter.has(t.status)).map((t) => t.id),
  );
  return deps.map((d) => ({
    id: d.id,
    source: d.sourceTaskId,
    target: d.targetTaskId,
    type: "smoothstep",
    animated: d.type === "blocks",
    hidden: !(visibleIds.has(d.sourceTaskId) && visibleIds.has(d.targetTaskId)),
    style: edgeStyleForType(d.type),
    data: { type: d.type },
  }));
}

function edgeStyleForType(type: TaskDependency["type"]): React.CSSProperties {
  switch (type) {
    case "blocks":  return { stroke: "#FF3D6B", strokeWidth: 2 };
    case "subtask": return { stroke: "#6C63FF", strokeWidth: 1.5 };
    default:        return { stroke: "#666680", strokeWidth: 1.5, strokeDasharray: "4 4" };
  }
}
