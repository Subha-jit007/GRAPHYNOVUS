"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CascadeImpact, Task } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impact: CascadeImpact;
  // All tasks in the project — used to resolve task titles from IDs.
  tasks: Task[];
  // Called when user accepts the current plan (simple delay or rebalanced).
  // Parent is responsible for persisting the changes.
  onAccept: () => Promise<void>;
  // Called when user wants to discard the due-date change.
  onRevert: () => void;
  // Called when user wants Gemini to suggest an optimised schedule.
  // Must return the updated CascadeImpact (with rebalancedTasks filled in).
  onRebalance: () => Promise<CascadeImpact>;
}

export function CascadeModal({
  open,
  onOpenChange,
  impact,
  tasks,
  onAccept,
  onRevert,
  onRebalance,
}: Props) {
  const [localImpact, setLocalImpact] = useState<CascadeImpact>(impact);
  const [rebalancing, setRebalancing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync if parent re-opens with a fresh impact
  const effectiveImpact = open ? localImpact : impact;
  const hasRebalance = !!effectiveImpact.rebalancedTasks?.length;

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply changes");
      setAccepting(false);
    }
  };

  const handleRebalance = async () => {
    setRebalancing(true);
    setError(null);
    try {
      const updated = await onRebalance();
      setLocalImpact(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rebalance failed — try again",
      );
    } finally {
      setRebalancing(false);
    }
  };

  const handleRevert = () => {
    setLocalImpact(impact); // reset local state
    setError(null);
    onRevert();
  };

  const sign = effectiveImpact.totalDelayDays >= 0 ? "+" : "";
  const delayLabel = `${sign}${effectiveImpact.totalDelayDays} day${Math.abs(effectiveImpact.totalDelayDays) !== 1 ? "s" : ""}`;
  const isDelay = effectiveImpact.totalDelayDays > 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[92vw] max-w-lg max-h-[88vh] overflow-y-auto glass rounded-2xl p-6 space-y-5 focus:outline-none">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isDelay ? "bg-[#FF3D6B]/15 text-[#FF3D6B]" : "bg-[#00FF88]/15 text-[#00FF88]",
              )}>
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <Dialog.Title className="font-display font-bold text-base leading-tight">
                  Cascade Impact
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                  This date change ripples to {effectiveImpact.affected.length} dependent task
                  {effectiveImpact.affected.length !== 1 ? "s" : ""}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-muted-foreground hover:text-foreground mt-0.5">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Summary banner */}
          <div className={cn(
            "rounded-xl border px-4 py-3 flex items-center gap-3",
            isDelay
              ? "border-[#FF3D6B]/25 bg-[#FF3D6B]/8"
              : "border-[#00FF88]/25 bg-[#00FF88]/8",
          )}>
            <AlertTriangle className={cn(
              "w-4 h-4 shrink-0",
              isDelay ? "text-[#FF3D6B]" : "text-[#00FF88]",
            )} />
            <p className="text-sm">
              <span className="font-semibold">{delayLabel}</span>
              {" "}propagates to{" "}
              <span className="font-semibold">{effectiveImpact.affected.length}</span>
              {" "}task{effectiveImpact.affected.length !== 1 ? "s" : ""}
              {effectiveImpact.finalDateShift && (
                <>
                  {" — "}project end date shifts to{" "}
                  <span className="font-semibold">
                    {formatDate(effectiveImpact.finalDateShift)}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Rebalance narrative */}
          {effectiveImpact.rebalanceSuggestion && (
            <div className="rounded-xl border border-[#6C63FF]/25 bg-[#6C63FF]/8 px-4 py-3 flex gap-2.5">
              <Sparkles className="w-4 h-4 shrink-0 text-[#6C63FF] mt-0.5" />
              <p className="text-sm text-[#6C63FF]/90 leading-relaxed">
                {effectiveImpact.rebalanceSuggestion}
              </p>
            </div>
          )}

          {/* Affected task list */}
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {hasRebalance ? "Suggested schedule" : "Ripple preview"}
            </p>

            {hasRebalance ? (
              // Rebalanced view: show original → suggested date per task
              <RebalancedList
                rebalancedTasks={effectiveImpact.rebalancedTasks!}
                taskMap={taskMap}
              />
            ) : (
              // Plain delay view
              <PlainDelayList
                affected={effectiveImpact.affected}
                taskMap={taskMap}
              />
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              disabled={accepting || rebalancing}
              className="text-muted-foreground hover:text-foreground"
            >
              Revert date
            </Button>

            <div className="flex gap-2">
              {/* Ask AI to Rebalance — hidden once rebalanced */}
              {!hasRebalance && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRebalance}
                  disabled={rebalancing || accepting}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {rebalancing ? "Thinking…" : "Ask AI to Rebalance"}
                </Button>
              )}

              {hasRebalance && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRebalance}
                  disabled={rebalancing || accepting}
                  className="text-[#6C63FF] border-[#6C63FF]/30 hover:bg-[#6C63FF]/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {rebalancing ? "Thinking…" : "Re-run AI"}
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleAccept}
                disabled={accepting || rebalancing}
                className={cn(
                  hasRebalance
                    ? "bg-[#6C63FF] hover:bg-[#6C63FF]/90 text-white"
                    : "",
                )}
              >
                {accepting
                  ? "Applying…"
                  : hasRebalance
                    ? "Accept Rebalanced Plan"
                    : "Accept Changes"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlainDelayList({
  affected,
  taskMap,
}: {
  affected: CascadeImpact["affected"];
  taskMap: Map<string, Task>;
}) {
  return (
    <ul className="space-y-1">
      {affected.map(({ taskId, delayDays }) => {
        const task = taskMap.get(taskId);
        const sign = delayDays >= 0 ? "+" : "";
        return (
          <li
            key={taskId}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-surface/50 border border-border/50 text-sm"
          >
            <span className="truncate text-foreground/90">
              {task?.title ?? taskId}
            </span>
            <span className={cn(
              "shrink-0 text-xs font-mono font-semibold",
              delayDays > 0 ? "text-[#FF3D6B]" : "text-[#00FF88]",
            )}>
              {sign}{delayDays}d
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RebalancedList({
  rebalancedTasks,
  taskMap,
}: {
  rebalancedTasks: NonNullable<CascadeImpact["rebalancedTasks"]>;
  taskMap: Map<string, Task>;
}) {
  return (
    <ul className="space-y-1.5">
      {rebalancedTasks.map(({ taskId, suggestedDueDate, reason }) => {
        const task = taskMap.get(taskId);
        const original = task?.dueDate?.slice(0, 10);
        return (
          <li
            key={taskId}
            className="rounded-lg px-3 py-2.5 bg-surface/50 border border-[#6C63FF]/20 space-y-1"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm truncate font-medium text-foreground/90">
                {task?.title ?? taskId}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                {original && (
                  <>
                    <span className="line-through">{formatDate(original)}</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
                <span className="text-[#6C63FF] font-semibold">
                  {formatDate(suggestedDueDate)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">{reason}</p>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
