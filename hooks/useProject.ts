"use client";

import type { Project } from "@/types";

export function useProject(projectId: string): {
  project: Project | null;
  loading: boolean;
  error: Error | null;
} {
  // TODO(MVP): fetch project from /api/projects or Supabase realtime channel
  return { project: null, loading: false, error: null };
}
