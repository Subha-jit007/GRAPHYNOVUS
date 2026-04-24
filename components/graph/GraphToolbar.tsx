"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { TaskStatus } from "@/types";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks";
import { STATUS_COLOR } from "@/components/graph/TaskNode";
import { cn } from "@/lib/utils";

// Floating toolbar (PRD §7.2 Graph View).
// Lives inside <ReactFlow> via <Panel> so it stays anchored over the canvas.
export function GraphToolbar({
  statusFilter,
  onToggleStatus,
  onReset,
  nodeCount,
  edgeCount,
}: {
  statusFilter: Set<TaskStatus>;
  onToggleStatus: (status: TaskStatus) => void;
  onReset: () => void;
  nodeCount: number;
  edgeCount: number;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const allOn = statusFilter.size === TASK_STATUSES.length;

  return (
    <Panel position="top-left" className="!m-3">
      <div className="glass rounded-xl p-2 flex flex-col gap-2 shadow-lg">
        <div className="flex items-center gap-1">
          <IconButton title="Zoom in" onClick={() => zoomIn()}>
            <ZoomIn className="w-4 h-4" />
          </IconButton>
          <IconButton title="Zoom out" onClick={() => zoomOut()}>
            <ZoomOut className="w-4 h-4" />
          </IconButton>
          <IconButton title="Fit view" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
            <Maximize2 className="w-4 h-4" />
          </IconButton>
          <div className="ml-2 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {nodeCount}n / {edgeCount}e
          </div>
        </div>

        <div className="flex flex-wrap gap-1 max-w-[360px]">
          {TASK_STATUSES.map((s) => {
            const active = statusFilter.has(s);
            const color = STATUS_COLOR[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggleStatus(s)}
                className={cn(
                  "text-[10px] uppercase tracking-wider font-mono rounded px-2 py-1 border transition",
                  active ? "border-transparent" : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={
                  active
                    ? { backgroundColor: `${color}22`, color, borderColor: `${color}88` }
                    : undefined
                }
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onReset}
            disabled={allOn}
            className="text-[10px] uppercase tracking-wider font-mono rounded px-2 py-1 border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
    </Panel>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface transition"
    >
      {children}
    </button>
  );
}
