"use client";

import type { CascadeImpact } from "@/types";

// Modal that surfaces Cascade Impact results (PRD USP-4).
// Shows ripple list + Accept / Revert / Ask AI to Rebalance buttons.
export function CascadeModal({
  impact,
  onAccept,
  onRevert,
  onRebalance,
}: {
  impact: CascadeImpact;
  onAccept: () => void;
  onRevert: () => void;
  onRebalance: () => void;
}) {
  // TODO(Phase 2): render as Radix Dialog with affected task list
  return null;
}
