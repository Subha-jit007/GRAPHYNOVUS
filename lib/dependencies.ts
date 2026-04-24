import type { DependencyType, TaskDependency } from "@/types";

export type DependencyRow = {
  id: string;
  source_task_id: string;
  target_task_id: string;
  type: DependencyType;
};

export function rowToDependency(row: DependencyRow): TaskDependency {
  return {
    id: row.id,
    sourceTaskId: row.source_task_id,
    targetTaskId: row.target_task_id,
    type: row.type,
  };
}

export const DEPENDENCY_TYPES: DependencyType[] = ["blocks", "related", "subtask"];
