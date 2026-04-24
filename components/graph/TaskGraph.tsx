"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
import type { Task, TaskDependency, TaskStatus } from "@/types";
import { TASK_STATUSES } from "@/lib/tasks";
import { TaskNode, STATUS_COLOR, type TaskNodeData } from "@/components/graph/TaskNode";
import { GraphToolbar } from "@/components/graph/GraphToolbar";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { useProjectStore } from "@/store/project-store";

// PRD USP-1 / §7.2: Neural Task Graph — force-style canvas of tasks and
// dependency edges, color-coded by status, size by dependents.
const NODE_TYPES = { task: TaskNode };

export function TaskGraph({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <TaskGraphInner projectId={projectId} />
    </ReactFlowProvider>
  );
}

function TaskGraphInner({ projectId }: { projectId: string }) {
  const tasks = useProjectStore((s) => s.tasks[projectId] ?? []);
  const deps = useProjectStore((s) => s.dependencies[projectId] ?? []);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const fetchDependencies = useProjectStore((s) => s.fetchDependencies);
  const createDependency = useProjectStore((s) => s.createDependency);
  const deleteDependency = useProjectStore((s) => s.deleteDependency);
  const setTaskPosition = useProjectStore((s) => s.setTaskPosition);

  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(
    () => new Set(TASK_STATUSES),
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    void fetchTasks(projectId);
    void fetchDependencies(projectId);
  }, [projectId, fetchTasks, fetchDependencies]);

  // Count outgoing blocker edges per task ("how many others depend on me").
  const dependentCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deps) {
      if (d.type !== "blocks") continue;
      counts[d.sourceTaskId] = (counts[d.sourceTaskId] ?? 0) + 1;
    }
    return counts;
  }, [deps]);

  // Build React Flow nodes + edges. We rebuild on upstream change and merge
  // local drag position via applyNodeChanges below.
  const [nodes, setNodes] = useState<Node<TaskNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setNodes(buildNodes(tasks, dependentCount, statusFilter));
  }, [tasks, dependentCount, statusFilter]);

  useEffect(() => {
    setEdges(buildEdges(deps, tasks, statusFilter));
  }, [deps, tasks, statusFilter]);

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
      // Optimistic local edge; swap in the server-returned id on success.
      const tempId = `tmp-${connection.source}-${connection.target}`;
      setEdges((es) => addEdge({ ...connection, id: tempId }, es));
      try {
        const dep = await createDependency(projectId, connection.source, connection.target);
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
    [projectId, createDependency],
  );

  const onEdgesDelete = useCallback(
    (removed: Edge[]) => {
      for (const edge of removed) {
        if (edge.id.startsWith("tmp-")) continue;
        void deleteDependency(projectId, edge.id).catch(() => {
          // Refetch on failure to resync edges.
          void fetchDependencies(projectId);
        });
      }
    },
    [projectId, deleteDependency, fetchDependencies],
  );

  const onNodeDragStop: NodeMouseHandler<Node<TaskNodeData>> = useCallback(
    (_event, node) => {
      void setTaskPosition(projectId, node.id, node.position.x, node.position.y);
    },
    [projectId, setTaskPosition],
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
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const resetFilter = useCallback(() => {
    setStatusFilter(new Set(TASK_STATUSES));
  }, []);

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
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          minZoom={0.2}
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

function buildNodes(
  tasks: Task[],
  dependentCount: Record<string, number>,
  statusFilter: Set<TaskStatus>,
): Node<TaskNodeData>[] {
  return tasks.map((t, i) => {
    const hasStored = t.positionX !== 0 || t.positionY !== 0;
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
    case "blocks":
      return { stroke: "#FF3D6B", strokeWidth: 2 };
    case "subtask":
      return { stroke: "#6C63FF", strokeWidth: 1.5 };
    case "related":
    default:
      return { stroke: "#666680", strokeWidth: 1.5, strokeDasharray: "4 4" };
  }
}
