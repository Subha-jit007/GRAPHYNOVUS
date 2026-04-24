# Product Requirements Document (PRD)
## Graphynovus — Gemini AI Project Board

**Version:** 1.0
**Status:** Ready for Development
**Target:** Claude Code (VS Code Extension)
**Author:** Tapas Kumar Das
**Date:** April 2026

---

## 1. Executive Summary

**Graphynovus** is an AI-native project management platform that goes far beyond traditional task boards. While tools like Notion, Trello, ClickUp, and Linear manage *what* you need to do, Graphynovus helps you *think, plan, and execute* using a neural graph engine powered by Google Gemini AI.

> **Core Promise:** "Stop managing tasks. Start executing goals."

The product combines three things no single competitor offers together:
- **Graph-based task topology** (visual dependency mesh, not linear lists)
- **AI Execution Cortex** (Gemini-powered reasoning that acts, not just suggests)
- **Project Entropy Engine** (health scoring that predicts failure before it happens)

---

## 2. Problem Statement

### Current Pain Points in Project Management

| Problem | How Existing Tools Fail |
|---|---|
| Complex projects with interdependent tasks | Trello/Notion treat tasks as isolated cards |
| Planning takes as long as doing | No AI that auto-structures goals into executable plans |
| Projects silently die mid-execution | No early-warning system for stalled momentum |
| Context switching kills focus | No AI that remembers your work style and adapts |
| Team doesn't know impact of changes | No cascade analysis when one task shifts |
| Voice/brain-dump ideas go unorganized | No tool that converts raw thoughts into structured plans |

---

## 3. Target Users

### Primary Persona — "The Builder"
- Solo founders, indie hackers, creators, freelancers
- Has 3–10 projects running simultaneously
- Frustrated with context switching and manual planning
- Tech-forward: comfortable with AI tools

### Secondary Persona — "The Team Lead"
- Small team lead (3–12 people)
- Needs visibility into bottlenecks and dependencies
- Wants automation without losing control

### Tertiary Persona — "The Student Researcher"
- Academic or self-learner managing complex multi-stage projects
- Needs structured thinking, not just storage

---

## 4. Unique Differentiating Features (USPs)

> These are features NO competitor currently offers in combination. This is the moat.

### USP-1: Neural Task Graph (Graph-Based Dependency Visualization)
**What it is:** Tasks are rendered as a live, interactive force-directed graph — not a flat list or kanban column. Each task is a node; dependencies, blockers, and sequences are edges.

**Why it's unique:** No mainstream PM tool (Trello, Asana, ClickUp, Linear) offers true graph topology. They fake it with "dependencies" in a list view.

**How it works:**
- User creates tasks; AI automatically infers possible dependencies using Gemini
- Graph is zoomable, draggable, filterable by status/assignee/tag
- Critical path is highlighted (tasks that block the most other tasks glow red)
- Clicking a node expands it into a detail panel without leaving the graph

**Tech:** React Flow (or D3.js for custom graph)

### USP-2: AI Execution Cortex (Gemini-Powered Action Engine)
**What it is:** An AI layer that doesn't just *suggest* — it *acts*. The Cortex can take a high-level goal written in plain language and:
1. Break it into structured tasks with time estimates
2. Detect missing steps the user didn't think of
3. Auto-assign tasks based on skill tags (for teams)
4. Generate a first draft of any deliverable (brief, email, code spec)

**Why it's unique:** Most AI tools bolt a chat box onto a static board. The Cortex is deeply integrated — it reads the project graph, understands context, and modifies the board directly.

**User Flow:**
```
User types: "Launch a YouTube automation channel in 30 days"
Cortex output:
  - 14 tasks generated with estimated durations
  - 3 dependency chains identified
  - Critical path: "Niche research -> Channel setup -> First 3 videos"
  - 2 missing steps flagged: "Create a content calendar", "Set up analytics"
  - Generates a Week 1 execution plan as a checklist
```

**Tech:** Google Gemini API (gemini-2.0-flash-exp)

### USP-3: Project Entropy Score
**What it is:** A real-time health metric (0–100) for every project. "Entropy" rises when:
- Tasks haven't moved in X days
- Blocker chains are too long
- Too many tasks are in "In Progress" simultaneously
- Deadlines are approaching with low completion %
- Team velocity is declining

**Why it's unique:** No PM tool actively warns you that a project is about to collapse. They show you the damage after it's done. Graphynovus predicts it.

**Visual Design:**
- Entropy gauge displayed per project on the dashboard
- Color scale: Green (0–30) -> Yellow (31–60) -> Red (61–100)
- AI generates a "Health Report" explaining *why* entropy is high
- One-click "Entropy Fix" — AI suggests 3 actions to reduce entropy immediately

### USP-4: Cascade Impact Analyzer
**What it is:** When you change, delay, or delete a task, the AI instantly shows you a "ripple view" — every other task that will be affected, with estimated delay impact in days.

**Why it's unique:** In every other tool, you manually trace "what breaks if I move this task." Graphynovus does it in one click.

**User Flow:**
```
User drags Task "Design UI" from Day 5 -> Day 9
Cascade Impact shows:
  - "Frontend Dev" delayed by 4 days
  - "QA Testing" delayed by 4 days
  - Final launch pushed from April 20 -> April 24
  - 2 team members affected
  - [Accept Changes] [Revert] [Ask AI to Rebalance]
```

### USP-5: Voice-to-Project (Brain Dump Mode)
**What it is:** User speaks freely for 30–120 seconds (or types a messy brain dump paragraph). Gemini converts it into a fully structured project with tasks, priorities, and timeline suggestions.

**Why it's unique:** Captures the "shower thought" and "whiteboard session" moment — when you have full clarity but no structured way to capture it fast.

**Tech:** Web Speech API + Gemini for parsing

### USP-6: Execution Memory (Cross-Project AI Learning)
**What it is:** The AI remembers your work patterns across projects:
- Which task types you always delay
- Your average velocity per category
- Your best productive hours (if integrated with calendar)
- Common blockers you encounter

**Why it's unique:** No PM tool has personalized behavioral intelligence. This is not generic AI — it's *your* AI.

**Privacy:** All memory stored locally or encrypted per user, never shared.

### USP-7: Live Context Panel (The "Second Brain" Sidebar)
**What it is:** A persistent sidebar that stays context-aware of what task you're viewing and surfaces:
- Related notes, links, files
- Previous AI suggestions on similar tasks
- Web search results for task keywords (via Gemini grounding)
- Team comments and status

**Why it's unique:** Most tools have static comment sections. This sidebar *thinks* about your task and proactively surfaces relevant information.

---

## 5. Core Feature Set

### 5.1 Project Management Core
- Create / Edit / Archive projects
- Task CRUD (Create, Read, Update, Delete)
- Task properties: Title, Description, Status, Priority, Due Date, Tags, Assignee, Time Estimate
- Task statuses: Backlog / Todo / In Progress / Blocked / Review / Done
- Sub-tasks (nested up to 3 levels)
- Task comments and activity log
- File attachments per task

### 5.2 Views
- **Graph View** — Neural Task Graph (USP-1) — PRIMARY VIEW
- **Kanban View** — Traditional column board
- **Timeline / Gantt View** — Drag-to-adjust timeline
- **List View** — Dense table for power users
- **Focus Mode** — Single task, full screen, distraction-free

### 5.3 AI Features (Gemini-Powered)
- AI Execution Cortex (USP-2)
- Project Entropy Score (USP-3)
- Cascade Impact Analyzer (USP-4)
- Voice-to-Project (USP-5)
- Execution Memory (USP-6)
- Live Context Panel (USP-7)
- Task description auto-writer
- Daily standup summary generator
- Blocker resolution suggestions

### 5.4 Dashboard
- Project cards with Entropy Score gauge
- Global task inbox (all tasks across projects)
- "Today's Focus" — AI-curated 3–5 most important tasks today
- Weekly velocity chart
- Upcoming deadlines widget
- Quick task creator (keyboard shortcut: `Cmd/Ctrl + K`)

### 5.5 Collaboration (Phase 2)
- Invite team members via email
- Role-based permissions (Owner / Editor / Viewer)
- Real-time cursor presence (multiplayer)
- Task assignment with notifications
- @mentions in comments

### 5.6 Integrations (Phase 2–3)
- GitHub — Link tasks to issues/PRs
- Google Calendar — Sync deadlines
- Slack — Notifications + task creation from Slack
- Notion import
- CSV import/export

---

## 6. Technical Architecture

### 6.1 Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS + shadcn/ui, React Flow, Zustand, Framer Motion, Lucide React
- **Backend:** Next.js API Routes, Supabase (Postgres + Auth + Realtime + Storage), Upstash Redis
- **AI:** Google Gemini API (`gemini-2.0-flash-exp`), Web Speech API, Gemini `text-embedding-004`, pgvector (Supabase)
- **Auth:** Supabase Auth (Google OAuth + Email Magic Link)
- **Deployment:** Vercel (frontend + API) + Supabase Cloud (DB + Auth)

### 6.2 Database Schema (Core Tables)
```sql
users (id, email, name, avatar_url, created_at, preferences_json)
projects (id, user_id, title, description, status, entropy_score, color, icon, created_at, archived_at)
tasks (id, project_id, parent_task_id, title, description, status, priority, due_date, assignee_id, estimated_hours, position_x, position_y, created_at, updated_at)
task_dependencies (id, source_task_id, target_task_id, type)   -- type: 'blocks' | 'related' | 'subtask'
ai_memory (id, user_id, pattern_type, pattern_data_json, confidence_score, updated_at)
comments (id, task_id, user_id, content, created_at)
tags (id, project_id, name, color)
task_tags (task_id, tag_id)
```

### 6.3 Project Folder Structure
See repo root — this scaffolding mirrors PRD §6.3 verbatim.

---

## 8. AI Feature Specs

### 8.1 Execution Cortex API
```
POST /api/ai/cortex
Body: {
  prompt: string,        // User's natural language goal
  projectId: string,     // Existing project context (optional)
  mode: 'generate' | 'expand' | 'fix' | 'standup'
}
Response: {
  tasks: Task[],
  dependencies: Dependency[],
  timeline: { startDate, endDate },
  criticalPath: string[],
  missingSteps: string[],
  weekOnePlan: string
}
```

### 8.2 Entropy Score Algorithm
```
entropy_score = weighted_sum([
  stale_task_ratio * 30,         // Tasks not updated in 3+ days
  blocker_chain_depth * 25,      // Longest blocker chain length
  wip_overflow * 20,             // In-Progress tasks > recommended limit
  deadline_pressure * 15,        // Tasks due in <48hrs with <50% done
  velocity_decline * 10          // Week-over-week task completion drop
])
```

### 8.3 Cascade Impact Engine
- On task date change: BFS traversal of dependency graph
- Calculate delay propagation per dependent task
- Return affected task list with estimated day shifts
- Show in modal with Accept / Revert / AI Rebalance options

---

## 9. Development Phases & Milestones

**Phase 1 — MVP (Weeks 1–6):** Auth, Project/Task CRUD + Kanban, Gemini integration, basic Cortex, Graph View (React Flow basic), basic Entropy, Dashboard, dark theme, Vercel deploy.

**Phase 2 — AI Power-Up (Weeks 7–10):** Cascade Impact, Voice-to-Project, Execution Memory (embeddings + pgvector), advanced Graph View, Timeline/Gantt View.

**Phase 3 — Collaboration (Weeks 11–14):** Team invites, Supabase Realtime multiplayer, notifications, @mentions, GitHub integration.

**Phase 4 — Growth (Month 4+):** Public API, Zapier/Make, mobile (React Native), Stripe payments, analytics dashboard.

---

## 10. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Page load time | < 2s (LCP) |
| AI response time (Cortex) | < 4s |
| Graph render (1000 nodes) | < 500ms |
| Uptime | 99.9% |
| Accessibility | WCAG 2.1 AA |
| Security | Row-level security (Supabase RLS) |
| Data privacy | User data isolated, AI memory encrypted |

---

## 11. Environment Variables

See `.env.example` at the repo root.

---

## 12. Acceptance Criteria (MVP)

- User can sign up, log in, and log out
- User can create a project and add tasks to it
- User can view tasks in Kanban view and drag between columns
- User can view tasks in Graph view with visible dependency edges
- User can type a goal and AI generates a structured task list
- Each project displays an Entropy Score
- App is deployed and publicly accessible on Vercel
- App loads in under 2 seconds on desktop
- All core actions work without page refresh (real-time updates)
