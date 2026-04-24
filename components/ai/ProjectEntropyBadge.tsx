"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EntropyGauge } from "@/components/ai/EntropyGauge";
import { entropyReasons } from "@/lib/entropy";
import { useEntropy } from "@/hooks/useEntropy";
import type { EntropyBreakdown } from "@/types";

// Floating entropy indicator pinned to the Graph view corner. Clicking it
// expands a panel with the weighted breakdown and top health warnings.
// The underlying useEntropy hook is store-subscribed, so the score animates
// whenever tasks or dependencies change.
export function ProjectEntropyBadge({ projectId }: { projectId: string }) {
  const { score, level, breakdown } = useEntropy(projectId);
  const [open, setOpen] = useState(false);
  const reasons = entropyReasons(breakdown);

  return (
    <div className="glass rounded-xl p-3 shadow-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        aria-label="Toggle entropy breakdown"
      >
        <EntropyGauge score={score} level={level} size="md" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Entropy
          </span>
          <span className="text-sm font-medium capitalize">{level}</span>
        </div>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-3 w-60 space-y-3 border-t border-border pt-3">
          <BreakdownRows breakdown={breakdown} />
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Health report
            </p>
            {reasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All factors look healthy.
              </p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-4 text-xs">
                {reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ROWS: Array<{ key: keyof EntropyBreakdown; label: string; weight: number }> = [
  { key: "staleTaskRatio", label: "Stale tasks", weight: 30 },
  { key: "blockerChainDepth", label: "Blocker chain", weight: 25 },
  { key: "wipOverflow", label: "WIP overflow", weight: 20 },
  { key: "deadlinePressure", label: "Deadlines", weight: 15 },
  { key: "velocityDecline", label: "Velocity drop", weight: 10 },
];

function BreakdownRows({ breakdown }: { breakdown: EntropyBreakdown }) {
  return (
    <ul className="space-y-1 text-[11px] text-muted-foreground">
      {ROWS.map((row) => {
        const raw = breakdown[row.key];
        const contrib = Math.round(raw * row.weight);
        const pct = Math.max(0, Math.min(1, raw));
        return (
          <li key={row.key} className="flex items-center gap-2">
            <span className="w-24 truncate">{row.label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-primary/70 transition-all"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono tabular-nums">
              {contrib}
              <span className="opacity-50">/{row.weight}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
