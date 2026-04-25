# Graphynovus — Current State PRD
**As of: April 25, 2026**

---

## 1. Overview

Graphynovus is an AI-native project management web app powered by Google Gemini. It turns raw goal descriptions into structured, executable task graphs with live dependency tracking and automated health monitoring.

**Stack:** Next.js 14 (App Router) · TypeScript · Supabase (Auth + PostgreSQL) · Google Gemini API · React Flow · Zustand · Tailwind CSS · Radix UI

**Theme:** Dark — `#0A0A0F` bg · `#6C63FF` primary · `#00D4FF` secondary · glassmorphism cards

---

## 2. Routes

| Route | Component | Status |
|---|---|---|
| `/` | Landing page | ✅ Built |
| `/login` | Auth (magic link) | ✅ Built |
| `/signup` | Auth (magic link) | ✅ Built |
| `/dashboard` | Project grid | ✅ Built |
| `/dashboard/project/[id]` | Redirects → graph | ✅ Built |
| `/dashboard/project/[id]/graph` | Neural Task Graph | ✅ Built |
| `/dashboard/project/[id]/kanban` | Kanban board | ✅ Built |
| `/dashboard/project/[id]/list` | List view | ⚠️ Stub |
| `/dashboard/project/[id]/timeline` | Timeline view | ⚠️ Stub |

---

## 3. Pages & Components

### 3.1 Landing Page (`/`)

- Marketing headline: "Stop managing tasks. Start executing goals."
- Sub-copy describing the neural graph engine powered by Gemini
- Two CTAs: "Get started" → `/signup`, "Log in" → `/login`
- Full-screen centered layout on dark background

### 3.2 Auth Pages (`/login`, `/signup`)

- Magic link email authentication via Supabase Auth
- Google OAuth button (renders; requires Supabase Google provider to be enabled)
- `AuthForm` component with `mode="login" | "signup"` prop
- On success: redirects to `/dashboard`
- Middleware protects `/dashboard/**`; redirects authenticated users from `/login` and `/signup` to `/dashboard`

### 3.3 Dashboard (`/dashboard`)

**Layout shell** (`app/dashboard/layout.tsx`):
- Server component; gates access via Supabase session check — unauthenticated → `/login`
- Sidebar: app logo, nav links (Dashboard, placeholder for project list)
- Header: page title + `UserMenu` (displays email, Sign Out button)
- Main content area

**TodayFocus** — placeholder stub; intended to show tasks due today across all projects

**ProjectGrid** (`components/dashboard/ProjectGrid.tsx`):
- Fetches all active projects for the current user from `/api/projects`
- Renders `ProjectCard` components in a 3-column responsive grid
- "New Project" button opens `NewProjectDialog`

**ProjectCard** (`components/dashboard/ProjectCard.tsx`):
- Glassmorphism card with hover border highlight
- Displays: project icon + title (custom color), relative creation time, description (2-line clamp), task count, `EntropyGauge` (sm size)
- Archive button (top-right, visible on hover) — calls `archiveProject` via Zustand store
- Full card is a link to `/dashboard/project/[id]`

**NewProjectDialog** (`components/dashboard/NewProjectDialog.tsx`):
- Radix Dialog modal
- Fields: Title (required), Description (optional)
- On submit: `POST /api/projects` → adds to Zustand store → dialog closes

### 3.4 Neural Task Graph (`/dashboard/project/[id]/graph`)

- React Flow canvas with custom `TaskNode` components
- Nodes positioned by `task.positionX / positionY` stored in DB
- Edges rendered for all `blocks`-type dependencies between tasks
- Node drag updates position in store and persists to Supabase via `setTaskPosition`

**TaskNode** (`components/graph/TaskNode.tsx`):
- Color-coded ring by status: green (done), blue (in_progress), yellow (review), red (blocked), gray (others)
- Shows: title, priority badge, due date (red if overdue)
- Scale proportional to number of incoming dependencies (more connected = larger node)
- Click opens `TaskDetail` dialog

**CortexPanel** (`components/ai/CortexPanel.tsx`):
- Sticky bottom bar on the graph view
- Text input for natural-language goal description
- Mode selector: `generate | expand | fix | standup`
- On submit: `POST /api/ai/cortex` with prompt + mode + projectId
- Loading spinner during API call
- Result card: structured task list (priority badges, estimated hours, critical path highlighted), missing steps list, Week 1 plan text
- Error banner on failure

**ProjectEntropyBadge** (`components/ai/ProjectEntropyBadge.tsx`):
- Floating badge, top-right of graph view
- Shows live entropy score + level (green/yellow/red) with `EntropyGauge`
- Expandable panel: score breakdown bars, health reason bullets
- Updates reactively whenever any task changes — no polling

### 3.5 Kanban Board (`/dashboard/project/[id]/kanban`)

- 6 columns: Backlog · To Do · In Progress · Blocked · Review · Done
- `@dnd-kit` drag-and-drop between columns
- WIP limit enforced on "In Progress" (limit = 3); over-limit columns show red header
- Optimistic status updates via Zustand store; PATCH to `/api/tasks/[id]` on drop
- **TaskCreator** (`components/tasks/TaskCreator.tsx`): inline "+ Add task" row at bottom of each column; creates task with that column's status on Enter

### 3.6 Task Detail Dialog (`components/tasks/TaskDetail.tsx`)

Full edit sheet for any task. Fields:
- Title (text input)
- Status (select: backlog / todo / in_progress / blocked / review / done)
- Priority (select: low / medium / high / urgent)
- Due date (date picker)
- Estimated hours (number input)
- Description (textarea)
- Tags (multi-select with color swatches; create new inline)
- Dependencies display (read-only list of blocking tasks)

On save: `PATCH /api/tasks/[id]` with changed fields. Optimistic update via Zustand.

---

## 4. AI Systems

### 4.1 Execution Cortex (`POST /api/ai/cortex`)

Powered by Gemini `gemini-2.0-flash-exp`.

**Input:**
```json
{ "prompt": "string", "projectId": "uuid?", "mode": "generate|expand|fix|standup" }
```

**Behavior by mode:**
- `generate` — creates full task breakdown from a goal description
- `expand` — expands a vague task into subtasks
- `fix` — suggests how to resolve blocked tasks
- `standup` — generates a standup summary for in-progress work

**Output (normalized):**
```json
{
  "tasks": [{ "title", "priority", "status", "estimatedHours", "description" }],
  "dependencies": [{ "sourceTaskId", "targetTaskId", "type" }],
  "timeline": { "startDate", "endDate" },
  "criticalPath": ["taskId", ...],
  "missingSteps": ["string", ...],
  "weekOnePlan": "string"
}
```

Normalization layer: temp IDs (t1..tN), enum coercion, dependency validation, critical-path validation.

### 4.2 Entropy Score (`lib/entropy.ts`)

Live project health score (0–100). Computed client-side from Zustand store data — no API call.

**Five factors (weighted sum):**

| Factor | Weight | Formula |
|---|---|---|
| Stale task ratio | 25% | Active tasks untouched ≥3 days / active count |
| Blocker chain depth | 25% | Longest transitive "blocks" chain (memoized DFS, cycle-safe), capped at 6 edges |
| WIP overflow | 20% | In-progress tasks beyond limit (3) / limit |
| Deadline pressure | 20% | Tasks due within ±48h and not in review/done |
| Velocity decline | 10% | Drop in done-count this week vs last week |

**Levels:** green (0–39) · yellow (40–69) · red (70–100)

**Exports:** `computeEntropy()`, `entropyReasons()` (human-readable health bullets), `entropyLevelFromScore()`

**EntropyGauge** (`components/ai/EntropyGauge.tsx`): SVG ring gauge, 500ms CSS transition, sizes sm/md/lg, optional breakdown bars.

**useEntropy hook** (`hooks/useEntropy.ts`): subscribes to `tasks[projectId]` + `dependencies[projectId]` in Zustand; recomputes via `useMemo` on any change.

### 4.3 Cascade Impact (`POST /api/ai/cascade`)

Analyzes delay ripple effects when a task slips. Returns affected tasks, delay days per task, total delay, and rebalance suggestion. (Route exists; UI integration pending.)

### 4.4 AI Memory (`GET/POST /api/ai/memory`)

Stores and retrieves user behavior patterns (pattern type + JSON data + confidence score) in `ai_memory` table. Used to personalize future Cortex suggestions. (Route exists; active usage pending.)

---

## 5. API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/projects` | List active projects for current user |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/[id]` | Get project by ID |
| PATCH | `/api/projects/[id]` | Update project (title, description, status, color, icon, entropyScore) |
| DELETE | `/api/projects/[id]` | Delete project |
| GET | `/api/tasks?projectId=` | List tasks for a project |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/[id]` | Get task by ID |
| PATCH | `/api/tasks/[id]` | Update task fields |
| DELETE | `/api/tasks/[id]` | Delete task |
| GET | `/api/dependencies?projectId=` | List dependencies for a project |
| POST | `/api/dependencies` | Create dependency |
| DELETE | `/api/dependencies/[id]` | Delete dependency |
| GET | `/api/tags?projectId=` | List tags for a project |
| POST | `/api/tags` | Create tag |
| POST | `/api/ai/cortex` | Execution Cortex (Gemini) |
| POST | `/api/ai/cascade` | Cascade impact analysis |
| GET/POST | `/api/ai/memory` | AI memory patterns |
| POST | `/api/ai/entropy` | Server-side entropy calculation (backup to client) |

All routes: authenticated via Supabase session cookie; 401 if unauthenticated.

---

## 6. Database Schema

**Tables:** `users`, `projects`, `tasks`, `task_dependencies`, `tags`, `task_tags`, `comments`, `ai_memory`

**Enums:** `project_status` (active/archived) · `task_status` (backlog/todo/in_progress/blocked/review/done) · `task_priority` (low/medium/high/urgent) · `dependency_type` (blocks/related/subtask)

**Key constraints:**
- `tasks.updated_at` auto-bumped by trigger on every UPDATE
- New `auth.users` row auto-creates a `public.users` profile row via trigger
- Self-dependency prevented: `check (source_task_id <> target_task_id)`
- Unique dependency: `unique (source_task_id, target_task_id, type)`

**Row Level Security:** Enabled on all tables. All data scoped to the authenticated user via `auth.uid()`. Tasks and dependencies are scoped transitively through the parent project's `user_id`.

---

## 7. State Management (`store/project-store.ts`)

Zustand store holds:
- `projects: Project[]`
- `tasks: Record<projectId, Task[]>`
- `dependencies: Record<projectId, TaskDependency[]>`

Actions: `fetchProjects`, `createProject`, `archiveProject`, `fetchTasks`, `createTask`, `updateTask`, `deleteTask`, `moveTask`, `setTaskPosition`, `fetchDependencies`, `createDependency`, `deleteDependency`

All mutations are optimistic — UI updates immediately, API call fires in background, rolls back on failure.

---

## 8. What Is Not Yet Built

| Feature | Status |
|---|---|
| TodayFocus panel | Stub (placeholder text only) |
| Context Sidebar (AI-powered) | Stub |
| Sidebar project list with entropy dots | TODO comment in layout |
| List view | Stub (empty page) |
| Timeline / Gantt view | Stub (empty page) |
| Task comments | DB table exists; no UI |
| Subtask hierarchy | DB supports `parent_task_id`; no UI |
| Node drag-to-persist (graph) | ✅ Done — `onNodeDragStop` → `setTaskPosition` → PATCH `/api/tasks/[id]` → `position_x`/`position_y` in DB; restored on load |
| Google OAuth | UI renders; Supabase provider not yet enabled |
| AI Memory active usage | Route exists; Cortex not yet reading patterns |
| Cascade Impact UI | Route exists; no UI entry point |
| Team / sharing | Not planned for MVP |
| Mobile layout | Partially responsive; not fully optimized |

---

## 9. Environment & Deployment

- **Hosting:** Vercel (Next.js)
- **Database:** Supabase (PostgreSQL + Auth)
- **AI:** Google Gemini API (`gemini-2.0-flash-exp`)
- **Required env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- **Pending config:** Supabase Site URL must be updated to the Vercel production domain for auth redirects to work in production
