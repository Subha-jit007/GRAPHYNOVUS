import type { Tag } from "@/types";

export type TagRow = {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
};

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color ?? "#6C63FF",
  };
}
