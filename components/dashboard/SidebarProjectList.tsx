"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils";

function entropyDotColor(score: number): string {
  if (score <= 30) return "#00FF88";
  if (score <= 60) return "#FFB800";
  return "#FF3D6B";
}

export function SidebarProjectList() {
  const projects    = useProjectStore((s) => s.projects);
  const loading     = useProjectStore((s) => s.loading);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const pathname    = usePathname();

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-1 pt-1">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-surface/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!loading && projects.length === 0) {
    return (
      <p className="pt-2 text-xs text-muted-foreground/50">
        No projects yet
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 pt-1">
      {projects.map((project) => {
        const base     = `/dashboard/project/${project.id}`;
        const isActive = pathname.startsWith(base);
        const color    = entropyDotColor(project.entropyScore);

        return (
          <li key={project.id}>
            <Link
              href={`${base}/graph`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/15 text-foreground font-medium"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                title={`Entropy ${project.entropyScore}`}
              />
              <span className="truncate">
                {project.icon ? `${project.icon} ` : ""}
                {project.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
