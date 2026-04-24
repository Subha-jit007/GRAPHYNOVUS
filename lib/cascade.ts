import type { CascadeImpact, Task, TaskDependency } from "@/types";

// Cascade Impact Engine — PRD USP-4, §8.3
// BFS over the dependency graph to propagate date shifts.
export function computeCascade(opts: {
  changedTaskId: string;
  newDueDate: string;
  tasks: Task[];
  dependencies: TaskDependency[];
}): CascadeImpact {
  // TODO(MVP): build adjacency map, BFS from changedTaskId, accumulate delays
  return {
    affected: [],
    totalDelayDays: 0,
    finalDateShift: null,
    rebalanceSuggestion: null,
  };
}
