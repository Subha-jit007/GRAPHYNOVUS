import type { Comment } from "@/types";

export type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users: { name: string | null; email: string } | null;
};

export function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.users?.name ?? null,
    userEmail: row.users?.email ?? null,
    content: row.content,
    createdAt: row.created_at,
  };
}
