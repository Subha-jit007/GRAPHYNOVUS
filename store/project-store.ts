import { create } from "zustand";
import type {
  DependencyType,
  Project,
  Tag,
  Task,
  TaskDependency,
  TaskPriority,
  TaskStatus,
} from "@/types";

export interface CreateProjectInput {
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  estimatedHours?: number | null;
  parentTaskId?: string | null;
  tagIds?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  estimatedHours?: number | null;
  parentTaskId?: string | null;
  tagIds?: string[];
}

interface ProjectState {
  activeProjectId: string | null;
  projects: Project[];
  tasks: Record<string, Task[]>;
  dependencies: Record<string, TaskDependency[]>;
  tags: Record<string, Tag[]>;
  loading: boolean;
  error: string | null;
  tasksLoading: boolean;
  tasksError: string | null;

  setActiveProject: (id: string | null) => void;
  setProjects: (projects: Project[]) => void;
  upsertTask: (projectId: string, task: Task) => void;
  removeTask: (projectId: string, taskId: string) => void;

  // Project CRUD
  fetchProjects: (opts?: { includeArchived?: boolean }) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, patch: UpdateProjectInput) => Promise<Project>;
  archiveProject: (id: string) => Promise<Project>;

  // Task CRUD
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (projectId: string, id: string, patch: UpdateTaskInput) => Promise<Task>;
  deleteTask: (projectId: string, id: string) => Promise<void>;
  // Optimistic status move with automatic revert on failure — used by the Kanban DnD.
  moveTask: (projectId: string, id: string, nextStatus: TaskStatus) => Promise<void>;
  // Fire-and-forget position save used by the Graph view on drag stop. Updates
  // local state immediately; swallows network errors (the UX is more important
  // than strict persistence for drag-tuning).
  setTaskPosition: (projectId: string, id: string, x: number, y: number) => Promise<void>;

  // Dependencies
  fetchDependencies: (projectId: string) => Promise<void>;
  createDependency: (
    projectId: string,
    sourceTaskId: string,
    targetTaskId: string,
    type?: DependencyType,
  ) => Promise<TaskDependency>;
  deleteDependency: (projectId: string, id: string) => Promise<void>;

  // Tags
  fetchTags: (projectId: string) => Promise<void>;
  createTag: (projectId: string, name: string, color?: string | null) => Promise<Tag>;
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as { error?: string } & T;
  if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`);
  return body;
}

function setTasksFor(
  state: ProjectState,
  projectId: string,
  updater: (prev: Task[]) => Task[],
): Partial<ProjectState> {
  return {
    tasks: { ...state.tasks, [projectId]: updater(state.tasks[projectId] ?? []) },
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeProjectId: null,
  projects: [],
  tasks: {},
  dependencies: {},
  tags: {},
  loading: false,
  error: null,
  tasksLoading: false,
  tasksError: null,

  setActiveProject: (id) => set({ activeProjectId: id }),
  setProjects: (projects) => set({ projects }),

  upsertTask: (projectId, task) =>
    set((state) =>
      setTasksFor(state, projectId, (prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        return idx === -1 ? [...prev, task] : prev.map((t) => (t.id === task.id ? task : t));
      }),
    ),

  removeTask: (projectId, taskId) =>
    set((state) => setTasksFor(state, projectId, (prev) => prev.filter((t) => t.id !== taskId))),

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
  fetchProjects: async (opts) => {
    set({ loading: true, error: null });
    try {
      const qs = opts?.includeArchived ? "?includeArchived=true" : "";
      const res = await fetch(`/api/projects${qs}`, { cache: "no-store" });
      const { projects } = await parseOrThrow<{ projects: Project[] }>(res);
      set({ projects, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "fetch failed" });
    }
  },

  createProject: async (input) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const { project } = await parseOrThrow<{ project: Project }>(res);
    set({ projects: [project, ...get().projects] });
    return project;
  },

  updateProject: async (id, patch) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const { project } = await parseOrThrow<{ project: Project }>(res);
    set({ projects: get().projects.map((p) => (p.id === id ? project : p)) });
    return project;
  },

  archiveProject: async (id) => {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const { project } = await parseOrThrow<{ project: Project }>(res);
    set({ projects: get().projects.filter((p) => p.id !== id) });
    return project;
  },

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------
  fetchTasks: async (projectId) => {
    set({ tasksLoading: true, tasksError: null });
    try {
      const res = await fetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      const { tasks } = await parseOrThrow<{ tasks: Task[] }>(res);
      set((state) => ({
        tasks: { ...state.tasks, [projectId]: tasks },
        tasksLoading: false,
      }));
    } catch (err) {
      set({
        tasksLoading: false,
        tasksError: err instanceof Error ? err.message : "fetch failed",
      });
    }
  },

  createTask: async (input) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const { task } = await parseOrThrow<{ task: Task }>(res);
    set((state) => setTasksFor(state, input.projectId, (prev) => [...prev, task]));
    return task;
  },

  updateTask: async (projectId, id, patch) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const { task } = await parseOrThrow<{ task: Task }>(res);
    set((state) =>
      setTasksFor(state, projectId, (prev) =>
        prev.map((t) => (t.id === id ? task : t)),
      ),
    );
    return task;
  },

  deleteTask: async (projectId, id) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await parseOrThrow<{ ok: true }>(res);
    set((state) => setTasksFor(state, projectId, (prev) => prev.filter((t) => t.id !== id)));
  },

  setTaskPosition: async (projectId, id, x, y) => {
    // Local update first so drags feel instant.
    set((state) =>
      setTasksFor(state, projectId, (list) =>
        list.map((t) => (t.id === id ? { ...t, positionX: x, positionY: y } : t)),
      ),
    );
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positionX: x, positionY: y }),
      });
    } catch {
      /* best-effort */
    }
  },

  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------
  fetchDependencies: async (projectId) => {
    const res = await fetch(
      `/api/dependencies?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    );
    const { dependencies } = await parseOrThrow<{ dependencies: TaskDependency[] }>(res);
    set((state) => ({
      dependencies: { ...state.dependencies, [projectId]: dependencies },
    }));
  },

  createDependency: async (projectId, sourceTaskId, targetTaskId, type = "blocks") => {
    const res = await fetch("/api/dependencies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceTaskId, targetTaskId, type }),
    });
    const { dependency } = await parseOrThrow<{ dependency: TaskDependency }>(res);
    set((state) => ({
      dependencies: {
        ...state.dependencies,
        [projectId]: [...(state.dependencies[projectId] ?? []), dependency],
      },
    }));
    return dependency;
  },

  deleteDependency: async (projectId, id) => {
    const res = await fetch(`/api/dependencies/${id}`, { method: "DELETE" });
    await parseOrThrow<{ ok: true }>(res);
    set((state) => ({
      dependencies: {
        ...state.dependencies,
        [projectId]: (state.dependencies[projectId] ?? []).filter((d) => d.id !== id),
      },
    }));
  },

  moveTask: async (projectId, id, nextStatus) => {
    const prev = get().tasks[projectId] ?? [];
    const target = prev.find((t) => t.id === id);
    if (!target || target.status === nextStatus) return;

    // Optimistic update.
    set((state) =>
      setTasksFor(state, projectId, (list) =>
        list.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)),
      ),
    );

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const { task } = await parseOrThrow<{ task: Task }>(res);
      set((state) =>
        setTasksFor(state, projectId, (list) =>
          list.map((t) => (t.id === id ? task : t)),
        ),
      );
    } catch (err) {
      // Revert on failure.
      set((state) =>
        setTasksFor(state, projectId, (list) =>
          list.map((t) => (t.id === id ? { ...t, status: target.status } : t)),
        ),
      );
      throw err;
    }
  },

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------
  fetchTags: async (projectId) => {
    const res = await fetch(`/api/tags?projectId=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    });
    const { tags } = await parseOrThrow<{ tags: Tag[] }>(res);
    set((state) => ({ tags: { ...state.tags, [projectId]: tags } }));
  },

  createTag: async (projectId, name, color) => {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, name, color: color ?? null }),
    });
    const { tag } = await parseOrThrow<{ tag: Tag }>(res);
    set((state) => ({
      tags: { ...state.tags, [projectId]: [...(state.tags[projectId] ?? []), tag] },
    }));
    return tag;
  },
}));
