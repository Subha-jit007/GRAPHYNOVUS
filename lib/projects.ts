import type { Project } from "@/types";

// snake_case DB row → camelCase domain type (PRD §6.2).
// Kept as a plain mapper so both the API route and the client fetcher
// produce the same shape.
type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "active" | "archived";
  entropy_score: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  archived_at: string | null;
};

export function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    entropyScore: row.entropy_score,
    color: row.color,
    icon: row.icon,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function entropyLevel(score: number): "green" | "yellow" | "red" {
  if (score <= 30) return "green";
  if (score <= 60) return "yellow";
  return "red";
}
