import type { CascadeImpact, Task, TaskDependency } from "@/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// BFS over the "blocks" dependency graph to propagate a date-shift delta.
// source → [targets] means "source must finish before target starts".
// When source shifts by N days, all reachable targets shift by N days too.
export function computeCascade(opts: {
  changedTaskId: string;
  newDueDate: string; // YYYY-MM-DD or ISO string
  tasks: Task[];
  dependencies: TaskDependency[];
}): CascadeImpact {
  const { changedTaskId, newDueDate, tasks, dependencies } = opts;

  const changedTask = tasks.find((t) => t.id === changedTaskId);
  if (!changedTask?.dueDate) return empty();

  const deltaDays = Math.round(
    (new Date(newDueDate).getTime() - new Date(changedTask.dueDate).getTime()) /
      MS_PER_DAY,
  );
  if (deltaDays === 0) return empty();

  // Adjacency: sourceTaskId → [targetTaskIds] for "blocks" edges only
  const adj = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (dep.type !== "blocks") continue;
    const list = adj.get(dep.sourceTaskId) ?? [];
    list.push(dep.targetTaskId);
    adj.set(dep.sourceTaskId, list);
  }

  // BFS — propagate the same delta to all reachable descendants.
  // We track the maximum absolute delay seen per node so that diamond-shaped
  // dependency graphs don't double-count or produce oscillating updates.
  const visited = new Map<string, number>(); // taskId → delay days
  const queue: Array<{ id: string; delay: number }> = [
    { id: changedTaskId, delay: deltaDays },
  ];

  while (queue.length > 0) {
    const { id, delay } = queue.shift()!;
    for (const neighbor of adj.get(id) ?? []) {
      const existing = visited.get(neighbor);
      if (existing === undefined || Math.abs(delay) > Math.abs(existing)) {
        visited.set(neighbor, delay);
        queue.push({ id: neighbor, delay });
      }
    }
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const affected = [...visited.entries()]
    .map(([taskId, delayDays]) => ({ taskId, delayDays }))
    .sort((a, b) => Math.abs(b.delayDays) - Math.abs(a.delayDays));

  // The new furthest end date across all affected tasks
  let latestNewDate: Date | null = null;
  for (const { taskId, delayDays } of affected) {
    const task = taskMap.get(taskId);
    if (task?.dueDate) {
      const shifted = new Date(
        new Date(task.dueDate).getTime() + delayDays * MS_PER_DAY,
      );
      if (!latestNewDate || shifted > latestNewDate) latestNewDate = shifted;
    }
  }

  return {
    affected,
    totalDelayDays: deltaDays,
    finalDateShift: latestNewDate
      ? latestNewDate.toISOString().slice(0, 10)
      : null,
    rebalanceSuggestion: null,
    rebalancedTasks: null,
  };
}

function empty(): CascadeImpact {
  return {
    affected: [],
    totalDelayDays: 0,
    finalDateShift: null,
    rebalanceSuggestion: null,
    rebalancedTasks: null,
  };
}
