// =============================================================================
// Graphynovus — Shared TypeScript types
// Mirrors the DB schema from PRD §6.2
// =============================================================================

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type DependencyType = "blocks" | "related" | "subtask";

export type EntropyLevel = "green" | "yellow" | "red";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  preferences: Record<string, unknown>;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: "active" | "archived";
  entropyScore: number;
  color: string | null;
  icon: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  estimatedHours: number | null;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface TaskDependency {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: DependencyType;
}

export interface AIMemory {
  id: string;
  userId: string;
  patternType: string;
  patternData: Record<string, unknown>;
  confidenceScore: number;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

// -----------------------------------------------------------------------------
// AI API contracts (PRD §8)
// -----------------------------------------------------------------------------

export type CortexMode = "generate" | "expand" | "fix" | "standup";

export interface CortexRequest {
  prompt: string;
  projectId?: string;
  mode: CortexMode;
}

export interface CortexResponse {
  tasks: Partial<Task>[];
  dependencies: Partial<TaskDependency>[];
  timeline: { startDate: string | null; endDate: string | null };
  criticalPath: string[];
  missingSteps: string[];
  weekOnePlan: string;
}

export interface EntropyBreakdown {
  staleTaskRatio: number;
  blockerChainDepth: number;
  wipOverflow: number;
  deadlinePressure: number;
  velocityDecline: number;
}

export interface CascadeImpact {
  affected: Array<{ taskId: string; delayDays: number }>;
  totalDelayDays: number;
  finalDateShift: string | null;
  rebalanceSuggestion: string | null;
}
