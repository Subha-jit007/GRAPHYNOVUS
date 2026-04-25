"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Comment } from "@/types";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useProjectStore } from "@/store/project-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CurrentUser = { id: string; email: string; name: string | null };

export function CommentThread({ taskId }: { taskId: string }) {
  const comments = useProjectStore((s) => s.comments[taskId] ?? []);
  const fetchComments = useProjectStore((s) => s.fetchComments);
  const createComment = useProjectStore((s) => s.createComment);
  const deleteComment = useProjectStore((s) => s.deleteComment);

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const prevCommentCount = useRef(comments.length);

  useEffect(() => {
    void fetchComments(taskId);
    getBrowserSupabase()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) {
          setCurrentUser({
            id: user.id,
            email: user.email ?? "",
            name:
              (user.user_metadata?.name as string | undefined) ??
              (user.user_metadata?.full_name as string | undefined) ??
              null,
          });
        }
      });
  }, [taskId, fetchComments]);

  // Scroll to bottom only when a new comment is added (not on initial load).
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (comments.length > prevCommentCount.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevCommentCount.current = comments.length;
  }, [comments]);

  const handleSubmit = async () => {
    const text = content.trim();
    if (!text || !currentUser || submitting) return;
    setContent("");
    setError(null);
    setSubmitting(true);
    try {
      await createComment(taskId, text, currentUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(taskId, commentId);
    } catch {
      // fetchComments is called internally on failure to resync
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
        Activity
      </h3>

      {/* Thread */}
      <div
        ref={threadRef}
        className="space-y-3 max-h-52 overflow-y-auto pr-1"
      >
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            No comments yet. Be the first.
          </p>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUser?.id ?? null}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          rows={2}
          placeholder="Add a comment… (Ctrl+Enter to post)"
          disabled={submitting}
          className="w-full rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-50"
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!content.trim() || submitting || !currentUser}
            onClick={handleSubmit}
          >
            {submitting ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: Comment;
  currentUserId: string | null;
  onDelete: (id: string) => void;
}) {
  const isOptimistic = comment.id.startsWith("tmp-");
  const isOwn = comment.userId === currentUserId;
  const displayName = comment.userName ?? comment.userEmail ?? "Unknown";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className={cn("flex gap-2.5 group", isOptimistic && "opacity-60")}>
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold truncate">
            {isOptimistic ? "You" : displayName}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {isOwn && !isOptimistic ? (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              aria-label="Delete comment"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : null}
        </div>
        <p className="text-sm mt-0.5 break-words text-foreground/90 whitespace-pre-wrap">
          {comment.content}
        </p>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
