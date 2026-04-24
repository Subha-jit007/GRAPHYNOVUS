"use client";

import type { EntropyBreakdown, EntropyLevel } from "@/types";
import { cn } from "@/lib/utils";

// Entropy Score gauge (PRD USP-3, §7.2). 0–100, color-coded.
// Rendered as an SVG ring that fills proportionally to the score, with the
// numeric value in the center. The optional breakdown prop enables a small
// details block beneath the ring listing the weighted contributions.
const LEVEL_STROKE: Record<EntropyLevel, string> = {
  green: "#00FF88",
  yellow: "#FACC15",
  red: "#FF3D6B",
};

const LEVEL_TEXT: Record<EntropyLevel, string> = {
  green: "text-entropy-green",
  yellow: "text-yellow-400",
  red: "text-entropy-red",
};

const SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 40,
  md: 64,
  lg: 96,
};

const FONT_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "text-[10px]",
  md: "text-base",
  lg: "text-2xl",
};

export function EntropyGauge({
  score,
  level,
  size = "md",
  breakdown,
  label,
  className,
}: {
  score: number;
  level: EntropyLevel;
  size?: "sm" | "md" | "lg";
  breakdown?: EntropyBreakdown;
  label?: string;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const stroke = size === "sm" ? 3 : size === "lg" ? 8 : 5;
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - pct);
  const color = LEVEL_STROKE[level];

  return (
    <div
      className={cn("inline-flex flex-col items-center gap-1.5", className)}
      title={`Entropy: ${score}/100 (${level})`}
    >
      <div className="relative" style={{ width: px, height: px }}>
        <svg
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={px / 2}
            cy={px / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 500ms ease-out" }}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono font-bold",
            LEVEL_TEXT[level],
            FONT_CLASS[size],
          )}
          aria-label={`Entropy score ${score} out of 100`}
        >
          {score}
        </span>
      </div>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      {breakdown && size !== "sm" && (
        <EntropyBreakdownList breakdown={breakdown} />
      )}
    </div>
  );
}

function EntropyBreakdownList({ breakdown }: { breakdown: EntropyBreakdown }) {
  const rows: Array<{ key: keyof EntropyBreakdown; label: string; weight: number }> = [
    { key: "staleTaskRatio", label: "Stale tasks", weight: 30 },
    { key: "blockerChainDepth", label: "Blocker chain", weight: 25 },
    { key: "wipOverflow", label: "WIP overflow", weight: 20 },
    { key: "deadlinePressure", label: "Deadlines", weight: 15 },
    { key: "velocityDecline", label: "Velocity drop", weight: 10 },
  ];
  return (
    <ul className="w-full space-y-0.5 text-[11px] text-muted-foreground">
      {rows.map((row) => {
        const raw = breakdown[row.key];
        const contrib = Math.round(raw * row.weight);
        return (
          <li key={row.key} className="flex items-center justify-between gap-3">
            <span className="truncate">{row.label}</span>
            <span className="font-mono tabular-nums">
              {contrib}
              <span className="opacity-50">/{row.weight}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
