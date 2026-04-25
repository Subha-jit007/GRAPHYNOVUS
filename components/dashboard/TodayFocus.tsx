"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logTaskCompletion } from "@/lib/memory";
import { REASON_COLORS, REASON_LABELS, type FocusItem } from "@/lib/focus";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TodayFocus() {
  const [items, setItems] = useState<FocusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  // "Why these?" state
  const [whyOpen, setWhyOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [whyLoading, setWhyLoading] = useState(false);

  const fetchFocus = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);
    setWhyOpen(false);
    try {
      const res = await fetch("/api/ai/focus", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to load focus list");
      }
      const { items: fetched } = (await res.json()) as { items: FocusItem[] };
      setItems(fetched ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFocus();
  }, [fetchFocus]);

  const fetchExplanation = async (currentItems: FocusItem[]) => {
    if (!currentItems.length) return;
    setWhyLoading(true);
    try {
      const res = await fetch("/api/ai/focus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: currentItems }),
      });
      const { explanation: text } = (await res.json()) as { explanation: string };
      setExplanation(text || null);
    } catch {
      setExplanation("Unable to generate explanation right now.");
    } finally {
      setWhyLoading(false);
    }
  };

  const toggleWhy = () => {
    const next = !whyOpen;
    setWhyOpen(next);
    // Lazy-fetch the explanation the first time the section is opened.
    if (next && explanation === null && !whyLoading) {
      void fetchExplanation(items);
    }
  };

  const handleComplete = async (item: FocusItem) => {
    const id = item.task.id;
    setCompleting((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) throw new Error("update failed");

      // Fire memory completion event (best-effort)
      logTaskCompletion({ ...item.task, status: "done" });

      // Fade-out then remove from list
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.task.id !== id));
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        // Invalidate cached explanation so it regenerates with the new list
        setExplanation(null);
      }, 400);
    } catch {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="glass rounded-2xl border border-border overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6C63FF]" />
          <span className="text-sm font-semibold">AI-curated priority queue</span>
        </div>
        <button
          type="button"
          onClick={fetchFocus}
          disabled={loading}
          title="Refresh focus list"
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface transition disabled:opacity-40"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Body */}
      <div className="divide-y divide-border/40">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFocus} />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          items.map((item) => (
            <FocusRow
              key={item.task.id}
              item={item}
              completing={completing.has(item.task.id)}
              onComplete={handleComplete}
            />
          ))
        )}
      </div>

      {/* "Why these?" footer — only shown when there are tasks */}
      {!loading && !error && items.length > 0 && (
        <div className="border-t border-border/60">
          <button
            type="button"
            onClick={toggleWhy}
            className="flex items-center gap-1.5 w-full px-5 py-3 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {whyOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Why these?
          </button>

          {whyOpen && (
            <div className="px-5 pb-4">
              {whyLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Asking AI…
                </div>
              ) : explanation ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {explanation}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No explanation available.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

function FocusRow({
  item,
  completing,
  onComplete,
}: {
  item: FocusItem;
  completing: boolean;
  onComplete: (item: FocusItem) => void;
}) {
  const { task, project, reasons } = item;
  const projectColor = project.color ?? "#6C63FF";

  const dueLabel = task.dueDate
    ? formatDue(new Date(task.dueDate))
    : null;

  const isOverdue =
    !!task.dueDate && new Date(task.dueDate).setHours(23, 59, 59) < Date.now();
  const isDueToday = reasons.includes("due_today");

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-3.5 transition-all",
        completing ? "opacity-30 scale-[0.99]" : "hover:bg-surface/30",
      )}
    >
      {/* Project color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: projectColor }}
      />

      {/* Title + project + reasons */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/project/${project.id}`}
            className="text-sm font-medium truncate hover:text-primary transition"
          >
            {task.title}
          </Link>
          {/* Reason chips — show at most 2 to avoid overflow */}
          {reasons.slice(0, 2).map((r) => (
            <span
              key={r}
              className={cn(
                "text-[10px] rounded border px-1.5 py-0.5 font-medium shrink-0",
                REASON_COLORS[r],
              )}
            >
              {REASON_LABELS[r]}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{project.title}</p>
      </div>

      {/* Due date chip */}
      {dueLabel && (
        <span
          className={cn(
            "shrink-0 text-[11px] rounded-md border px-2 py-0.5 font-mono tabular-nums",
            isOverdue
              ? "border-[#FF3D6B]/30 bg-[#FF3D6B]/10 text-[#FF3D6B]"
              : isDueToday
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-border bg-surface/60 text-muted-foreground",
          )}
        >
          {dueLabel}
        </span>
      )}

      {/* Complete button */}
      <button
        type="button"
        onClick={() => onComplete(item)}
        disabled={completing}
        title="Mark as done"
        className={cn(
          "shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-[#00FF88] transition",
          completing && "pointer-events-none",
        )}
      >
        <CheckCircle2 className="w-5 h-5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="w-2.5 h-2.5 rounded-full bg-surface animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3 rounded bg-surface animate-pulse"
              style={{ width: `${55 + (i % 3) * 15}%` }}
            />
            <div className="h-2.5 w-24 rounded bg-surface animate-pulse" />
          </div>
          <div className="h-5 w-14 rounded bg-surface animate-pulse" />
          <div className="h-5 w-5 rounded-full bg-surface animate-pulse" />
        </div>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-10 text-center space-y-1">
      <p className="text-sm font-medium">You&apos;re all caught up 🎉</p>
      <p className="text-xs text-muted-foreground">
        No overdue, urgent, or stale tasks found across your projects.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-5 py-6 text-center space-y-2">
      <p className="text-xs text-destructive">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDue(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diff = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return "yesterday";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return `in ${diff}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
