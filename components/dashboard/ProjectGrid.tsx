"use client";

import { useEffect } from "react";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { useProjectStore } from "@/store/project-store";

// Client-side list of the current user's projects. Fetches on mount so the
// dashboard server component stays lean.
export function ProjectGrid() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const error = useProjectStore((s) => s.error);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading && projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Loading projects…</p>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (projects.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center space-y-2">
        <p className="font-display text-lg font-bold">No projects yet</p>
        <p className="text-sm text-muted-foreground">
          Click <span className="text-foreground">New Project</span> to start your first one.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
