"use client";

import { useEffect, useMemo } from "react";
import type { EntropyBreakdown, EntropyLevel } from "@/types";
import { computeEntropy } from "@/lib/entropy";
import { useProjectStore } from "@/store/project-store";

export interface UseEntropyResult {
  score: number;
  level: EntropyLevel;
  breakdown: EntropyBreakdown;
  loading: boolean;
}

// Live entropy for the given project. Subscribes to tasks + dependencies in
// the project store so the gauge refreshes on every create/update/delete/move
// without a network round-trip. The score is derived purely client-side from
// data already loaded by the Graph / Kanban views; if they haven't loaded yet
// this hook kicks the fetch.
export function useEntropy(projectId: string): UseEntropyResult {
  const tasks = useProjectStore((s) => s.tasks[projectId]);
  const deps = useProjectStore((s) => s.dependencies[projectId]);
  const tasksLoading = useProjectStore((s) => s.tasksLoading);
  const fetchTasks = useProjectStore((s) => s.fetchTasks);
  const fetchDependencies = useProjectStore((s) => s.fetchDependencies);

  useEffect(() => {
    if (!projectId) return;
    if (tasks === undefined) void fetchTasks(projectId);
    if (deps === undefined) void fetchDependencies(projectId);
  }, [projectId, tasks, deps, fetchTasks, fetchDependencies]);

  const result = useMemo(
    () => computeEntropy(tasks ?? [], deps ?? []),
    [tasks, deps],
  );

  return {
    score: result.score,
    level: result.level,
    breakdown: result.breakdown,
    loading: tasks === undefined || tasksLoading,
  };
}
