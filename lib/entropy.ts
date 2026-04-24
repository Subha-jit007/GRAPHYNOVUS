import type {
  EntropyBreakdown,
  EntropyLevel,
  Task,
  TaskDependency,
} from "@/types";
import { WIP_LIMITS } from "@/lib/tasks";

// Weights from PRD §8.2. Sum = 100, so the final score lives in [0, 100]
// when each breakdown factor is normalized to [0, 1].
const WEIGHTS = {
  staleTaskRatio: 30,
  blockerChainDepth: 25,
  wipOverflow: 20,
  deadlinePressure: 15,
  velocityDecline: 10,
} as const;

const STALE_MS = 3 * 24 * 60 * 60 * 1000;
const DEADLINE_MS = 48 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// A chain length >= this value is treated as maximally bad for the factor.
const DEEP_CHAIN_CAP = 6;

export interface EntropyResult {
  score: number;
  level: EntropyLevel;
  breakdown: EntropyBreakdown;
}

// Pure function — same (tasks, deps, now) input → same output. Safe to call
// from render or a useMemo without any network.
export function computeEntropy(
  tasks: Task[],
  dependencies: TaskDependency[] = [],
  now: number = Date.now(),
): EntropyResult {
  const active = tasks.filter((t) => t.status !== "done");
  const activeCount = active.length;

  // --- 1. Stale task ratio: active tasks untouched in 3+ days -----------------
  const staleCount = active.reduce((n, t) => {
    const updated = Date.parse(t.updatedAt);
    if (Number.isNaN(updated)) return n;
    return now - updated >= STALE_MS ? n + 1 : n;
  }, 0);
  const staleTaskRatio = activeCount === 0 ? 0 : staleCount / activeCount;

  // --- 2. Blocker chain depth: longest transitive "blocks" chain --------------
  const depth = longestBlockerChain(tasks, dependencies);
  const blockerChainDepth = Math.min(1, depth / DEEP_CHAIN_CAP);

  // --- 3. WIP overflow: in-progress beyond the configured limit ---------------
  const limit = WIP_LIMITS.in_progress ?? 3;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const overflow = Math.max(0, inProgress - limit);
  const wipOverflow = Math.min(1, overflow / limit);

  // --- 4. Deadline pressure: tasks due <48h with low completion ---------------
  // We don't track per-task completion %, so we proxy "<50% done" as "not yet
  // in review or done" — anything still backlog/todo/in_progress/blocked.
  const atRisk = active.reduce((n, t) => {
    if (!t.dueDate) return n;
    if (t.status === "review") return n;
    const due = Date.parse(t.dueDate);
    if (Number.isNaN(due)) return n;
    const delta = due - now;
    return delta <= DEADLINE_MS && delta >= -DEADLINE_MS ? n + 1 : n;
  }, 0);
  const deadlinePressure = activeCount === 0 ? 0 : atRisk / activeCount;

  // --- 5. Velocity decline: this-week done vs last-week done ------------------
  let thisWeekDone = 0;
  let lastWeekDone = 0;
  for (const t of tasks) {
    if (t.status !== "done") continue;
    const updated = Date.parse(t.updatedAt);
    if (Number.isNaN(updated)) continue;
    const age = now - updated;
    if (age < 0) continue;
    if (age < WEEK_MS) thisWeekDone += 1;
    else if (age < 2 * WEEK_MS) lastWeekDone += 1;
  }
  const velocityDecline =
    lastWeekDone === 0
      ? 0
      : Math.max(0, (lastWeekDone - thisWeekDone) / lastWeekDone);

  const breakdown: EntropyBreakdown = {
    staleTaskRatio,
    blockerChainDepth,
    wipOverflow,
    deadlinePressure,
    velocityDecline,
  };

  const rawScore =
    staleTaskRatio * WEIGHTS.staleTaskRatio +
    blockerChainDepth * WEIGHTS.blockerChainDepth +
    wipOverflow * WEIGHTS.wipOverflow +
    deadlinePressure * WEIGHTS.deadlinePressure +
    velocityDecline * WEIGHTS.velocityDecline;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const level: EntropyLevel =
    score <= 30 ? "green" : score <= 60 ? "yellow" : "red";

  return { score, level, breakdown };
}

// Longest chain of transitive "blocks" edges, measured in number of edges.
// Cycles are broken by the visiting set so pathological data can't hang us.
function longestBlockerChain(
  tasks: Task[],
  deps: TaskDependency[],
): number {
  const adj = new Map<string, string[]>();
  for (const d of deps) {
    if (d.type !== "blocks") continue;
    const list = adj.get(d.sourceTaskId) ?? [];
    list.push(d.targetTaskId);
    adj.set(d.sourceTaskId, list);
  }
  if (adj.size === 0) return 0;

  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const dfs = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = 0;
    for (const next of adj.get(id) ?? []) {
      best = Math.max(best, dfs(next) + 1);
    }
    visiting.delete(id);
    memo.set(id, best);
    return best;
  };

  let max = 0;
  for (const t of tasks) max = Math.max(max, dfs(t.id));
  return max;
}

// Human-readable explanation for each factor — used by the UI and by the
// server-side "Health Report" fallback when Gemini isn't reachable.
export function entropyReasons(breakdown: EntropyBreakdown): string[] {
  const reasons: Array<{ score: number; text: string }> = [];
  if (breakdown.staleTaskRatio > 0.25) {
    reasons.push({
      score: breakdown.staleTaskRatio,
      text: `${Math.round(breakdown.staleTaskRatio * 100)}% of active tasks haven't moved in 3+ days`,
    });
  }
  if (breakdown.blockerChainDepth > 0.3) {
    reasons.push({
      score: breakdown.blockerChainDepth,
      text: `Long blocker chain (${Math.round(breakdown.blockerChainDepth * DEEP_CHAIN_CAP)} tasks deep)`,
    });
  }
  if (breakdown.wipOverflow > 0) {
    reasons.push({
      score: breakdown.wipOverflow,
      text: "Too many tasks in progress at once",
    });
  }
  if (breakdown.deadlinePressure > 0.2) {
    reasons.push({
      score: breakdown.deadlinePressure,
      text: `${Math.round(breakdown.deadlinePressure * 100)}% of tasks are due within 48h and not close to done`,
    });
  }
  if (breakdown.velocityDecline > 0.2) {
    reasons.push({
      score: breakdown.velocityDecline,
      text: `Velocity down ${Math.round(breakdown.velocityDecline * 100)}% vs last week`,
    });
  }
  return reasons.sort((a, b) => b.score - a.score).map((r) => r.text);
}

export function entropyLevelFromScore(score: number): EntropyLevel {
  if (score <= 30) return "green";
  if (score <= 60) return "yellow";
  return "red";
}
