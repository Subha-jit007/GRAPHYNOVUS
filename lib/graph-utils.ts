import type { Task, TaskDependency } from "@/types";

// Graph layout + critical-path helpers for the Neural Task Graph (USP-1).

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  data: Task;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: TaskDependency["type"];
}

export function tasksToNodes(tasks: Task[]): GraphNode[] {
  return tasks.map((t) => ({ id: t.id, x: t.positionX, y: t.positionY, data: t }));
}

export function dependenciesToEdges(deps: TaskDependency[]): GraphEdge[] {
  return deps.map((d) => ({
    id: d.id,
    source: d.sourceTaskId,
    target: d.targetTaskId,
    type: d.type,
  }));
}

// TODO(Phase 2): critical path (longest chain of dependencies to terminal nodes)
export function findCriticalPath(_nodes: GraphNode[], _edges: GraphEdge[]): string[] {
  return [];
}
