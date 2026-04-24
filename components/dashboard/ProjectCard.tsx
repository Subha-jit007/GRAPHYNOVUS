"use client";

import Link from "next/link";
import { Archive } from "lucide-react";
import type { Project } from "@/types";
import { entropyLevel } from "@/lib/projects";
import { EntropyGauge } from "@/components/ai/EntropyGauge";
import { useProjectStore } from "@/store/project-store";

// Dashboard project card (PRD §5.4 / §7.2).
// Shows title, entropy gauge, task count, and last activity.
export function ProjectCard({
  project,
  taskCount = 0,
}: {
  project: Project;
  taskCount?: number;
}) {
  const archiveProject = useProjectStore((s) => s.archiveProject);

  const onArchive = async (e: React.MouseEvent) => {
    // Don't navigate when the archive button is clicked.
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Archive "${project.title}"?`)) return;
    try {
      await archiveProject(project.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  return (
    <Link
      href={`/project/${project.id}`}
      className="glass group relative rounded-2xl p-5 space-y-4 hover:border-primary/40 transition block"
    >
      <button
        type="button"
        onClick={onArchive}
        title="Archive project"
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-surface"
      >
        <Archive className="w-4 h-4" />
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-display text-lg font-bold truncate"
            style={project.color ? { color: project.color } : undefined}
          >
            {project.icon ? `${project.icon} ` : ""}
            {project.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatRelative(project.createdAt)}
          </p>
        </div>
        <EntropyGauge
          score={project.entropyScore}
          level={entropyLevel(project.entropyScore)}
          size="sm"
        />
      </div>

      {project.description ? (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {project.description}
        </p>
      ) : null}

      <div className="text-xs text-muted-foreground">
        {taskCount} {taskCount === 1 ? "task" : "tasks"}
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
