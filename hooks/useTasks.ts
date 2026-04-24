"use client";

import type { Task, TaskDependency } from "@/types";

export function useTasks(projectId: string): {
  tasks: Task[];
  dependencies: TaskDependency[];
  loading: boolean;
  error: Error | null;
} {
  // TODO(MVP): fetch + subscribe via Supabase realtime
  return { tasks: [], dependencies: [], loading: false, error: null };
}
