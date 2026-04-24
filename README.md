# Graphynovus

> Stop managing tasks. Start executing goals.

AI-native project management built around a neural task graph and a Gemini-powered execution cortex. See [PRD.md](PRD.md) for the full spec.

## Features

- **Neural Task Graph** — force-directed graph of tasks and dependencies (React Flow v12)
- **AI Execution Cortex** — Gemini turns plain-language goals into a structured plan
- **Project Entropy Score** — live 0–100 health metric with weighted breakdown
- **Kanban Board** — drag-and-drop with WIP-limit warnings
- **Dark-first UI** — PRD §7.1 palette (electric violet / cyan / entropy red–green)

## Stack

- **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS** + **shadcn/ui**
- **@xyflow/react** (React Flow v12) for the Neural Task Graph
- **@dnd-kit** for Kanban drag-and-drop
- **Zustand** for global state · **Framer Motion** · **Lucide** icons
- **Supabase** (Postgres + Auth + Realtime + Storage + pgvector)
- **Google Gemini** (`gemini-2.0-flash-exp`, `text-embedding-004`)

## Prerequisites

- **Node.js 18.17+** (Next.js 14 minimum) or 20.x recommended
- A **Supabase** project ([supabase.com](https://supabase.com))
- A **Google Gemini** API key with access to `gemini-2.0-flash-exp` ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars and fill them in
cp .env.example .env.local

# 3. Apply the database schema to your Supabase project
#    (paste the contents of supabase/migrations/001_initial_schema.sql into
#    the Supabase SQL editor, or use the Supabase CLI — see below)

# 4. Configure Supabase Auth redirect URLs (Authentication → URL Configuration):
#    Site URL:       http://localhost:3000
#    Redirect URLs:  http://localhost:3000/auth/callback

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase migration

Two options for applying [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql):

**Option A — SQL editor (fastest):**
Paste the file contents into Supabase Dashboard → SQL Editor → Run.

**Option B — Supabase CLI:**
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Environment Variables

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | ✅ | Supabase anon public key |
| `GEMINI_API_KEY` | server only | ✅ | Google Gemini API key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | — | Reserved for future admin ops; safe to leave blank |
| `NEXT_PUBLIC_APP_URL` | client + server | — | Absolute base URL (set to your prod domain on Vercel) |
| `NEXT_PUBLIC_APP_NAME` | client + server | — | Display name (defaults to "Graphynovus") |
| `UPSTASH_REDIS_URL` | server only | — | Phase 2: Entropy cache |
| `UPSTASH_REDIS_TOKEN` | server only | — | Phase 2: Entropy cache |
| `PINECONE_API_KEY` | server only | — | Phase 2: alt vector DB (default is pgvector) |

Anything prefixed `NEXT_PUBLIC_` is inlined into the client bundle — never put secrets there.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run type-check` | `tsc --noEmit` |

## Deploy to Vercel

1. **Push to GitHub.**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/graphynovus.git
   git push -u origin main
   ```

2. **Import the repo on Vercel.**
   [vercel.com/new](https://vercel.com/new) → pick the repo. Framework is auto-detected as Next.js (also pinned in [vercel.json](vercel.json)).

3. **Add environment variables** in Vercel Project Settings → Environment Variables. At minimum:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`

   Apply each to **Production**, **Preview**, and **Development** as appropriate.

4. **Update Supabase Auth URLs** (Supabase Dashboard → Authentication → URL Configuration) to include your Vercel domain:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/auth/callback` (add your production domain too)

5. **Deploy.** Vercel builds on every push to `main`; PRs get Preview deployments automatically.

### What `vercel.json` does

- Pins the framework to Next.js (prevents detection surprises)
- Bumps `maxDuration` on the AI route handlers so Gemini calls don't get cut off during cold starts (Cortex → 30s, others → 15s)

No rewrites or redirects are configured — Next.js middleware in [middleware.ts](middleware.ts) handles auth gating.

## Project Structure

Mirrors [PRD.md §6.3](PRD.md). Key directories:

- [app/](app/) — App Router pages + `api/` route handlers
- [components/](components/) — feature-scoped (`graph`, `ai`, `kanban`, `tasks`, `dashboard`, `auth`, `ui`)
- [lib/](lib/) — `gemini.ts`, `supabase.ts`, `entropy.ts`, `cascade.ts`, `graph-utils.ts`, row↔domain mappers
- [hooks/](hooks/) — `useProject`, `useTasks`, `useAI`, `useEntropy`
- [store/project-store.ts](store/project-store.ts) — Zustand store (projects, tasks, deps, tags)
- [types/index.ts](types/index.ts) — shared TypeScript interfaces
- [supabase/migrations/](supabase/migrations/) — SQL schema

## Status

MVP scaffolding is in place. Phase 2/3/4 surfaces (Cascade Impact, Voice-to-Project, Execution Memory, collaboration, integrations) are marked with `TODO(Phase 2)` etc. referencing the PRD section that owns them.
