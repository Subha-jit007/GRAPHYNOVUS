-- ============================================================================
-- Graphynovus — Initial Schema (PRD §6.2)
-- Migration: 001_initial_schema.sql
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type project_status as enum ('active', 'archived');

create type task_status as enum (
  'backlog',
  'todo',
  'in_progress',
  'blocked',
  'review',
  'done'
);

create type task_priority as enum ('low', 'medium', 'high', 'urgent');

create type dependency_type as enum ('blocks', 'related', 'subtask');

-- ============================================================================
-- TABLES
-- ============================================================================

-- users: profile row mirroring auth.users (1:1)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  avatar_url text,
  preferences_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  status project_status not null default 'active',
  entropy_score integer not null default 0 check (entropy_score between 0 and 100),
  color text,
  icon text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index projects_user_id_idx on public.projects(user_id);
create index projects_status_idx on public.projects(status);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'backlog',
  priority task_priority not null default 'medium',
  due_date timestamptz,
  assignee_id uuid references public.users(id) on delete set null,
  estimated_hours numeric(6,2),
  position_x double precision,
  position_y double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_parent_task_id_idx on public.tasks(parent_task_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date);

-- task_dependencies
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_task_id uuid not null references public.tasks(id) on delete cascade,
  target_task_id uuid not null references public.tasks(id) on delete cascade,
  type dependency_type not null default 'blocks',
  created_at timestamptz not null default now(),
  unique (source_task_id, target_task_id, type),
  check (source_task_id <> target_task_id)
);

create index task_dependencies_source_idx on public.task_dependencies(source_task_id);
create index task_dependencies_target_idx on public.task_dependencies(target_task_id);

-- ai_memory
create table public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pattern_type text not null,
  pattern_data_json jsonb not null default '{}'::jsonb,
  confidence_score numeric(4,3) not null default 0 check (confidence_score between 0 and 1),
  updated_at timestamptz not null default now()
);

create index ai_memory_user_id_idx on public.ai_memory(user_id);
create index ai_memory_pattern_type_idx on public.ai_memory(pattern_type);

-- comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index comments_task_id_idx on public.comments(task_id);
create index comments_user_id_idx on public.comments(user_id);

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text,
  unique (project_id, name)
);

create index tags_project_id_idx on public.tags(project_id);

-- task_tags (join table)
create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

create index task_tags_tag_id_idx on public.task_tags(tag_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Bump tasks.updated_at on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger ai_memory_set_updated_at
  before update on public.ai_memory
  for each row execute function public.set_updated_at();

-- Auto-create public.users row when a new auth.users row is inserted
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users             enable row level security;
alter table public.projects          enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.ai_memory         enable row level security;
alter table public.comments          enable row level security;
alter table public.tags              enable row level security;
alter table public.task_tags         enable row level security;

-- ----------------------------------------------------------------------------
-- users: each user reads/updates only their own profile
-- ----------------------------------------------------------------------------
create policy "users_select_self"
  on public.users for select
  using (auth.uid() = id);

create policy "users_update_self"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT happens via the auth trigger (security definer); no client INSERT policy.

-- ----------------------------------------------------------------------------
-- projects: owner-only CRUD
-- ----------------------------------------------------------------------------
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- tasks: scoped through the parent project's owner
-- ----------------------------------------------------------------------------
create policy "tasks_select_own"
  on public.tasks for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_update_own"
  on public.tasks for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_delete_own"
  on public.tasks for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id and p.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- task_dependencies: scoped through the source task's project owner
-- ----------------------------------------------------------------------------
create policy "task_dependencies_select_own"
  on public.task_dependencies for select
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_dependencies.source_task_id and p.user_id = auth.uid()
    )
  );

create policy "task_dependencies_insert_own"
  on public.task_dependencies for insert
  with check (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_dependencies.source_task_id and p.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_dependencies.target_task_id and p.user_id = auth.uid()
    )
  );

create policy "task_dependencies_update_own"
  on public.task_dependencies for update
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_dependencies.source_task_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_dependencies.source_task_id and p.user_id = auth.uid()
    )
  );

create policy "task_dependencies_delete_own"
  on public.task_dependencies for delete
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_dependencies.source_task_id and p.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- ai_memory: owner-only CRUD
-- ----------------------------------------------------------------------------
create policy "ai_memory_select_own"
  on public.ai_memory for select
  using (auth.uid() = user_id);

create policy "ai_memory_insert_own"
  on public.ai_memory for insert
  with check (auth.uid() = user_id);

create policy "ai_memory_update_own"
  on public.ai_memory for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_memory_delete_own"
  on public.ai_memory for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- comments: visible to anyone who can see the parent task; only the author
-- can update/delete their comment
-- ----------------------------------------------------------------------------
create policy "comments_select_own"
  on public.comments for select
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = comments.task_id and p.user_id = auth.uid()
    )
  );

create policy "comments_insert_own"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = comments.task_id and p.user_id = auth.uid()
    )
  );

create policy "comments_update_own"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "comments_delete_own"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- tags: scoped through the parent project's owner
-- ----------------------------------------------------------------------------
create policy "tags_select_own"
  on public.tags for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.user_id = auth.uid()
    )
  );

create policy "tags_insert_own"
  on public.tags for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.user_id = auth.uid()
    )
  );

create policy "tags_update_own"
  on public.tags for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.user_id = auth.uid()
    )
  );

create policy "tags_delete_own"
  on public.tags for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = tags.project_id and p.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- task_tags: scoped through the task's project owner
-- ----------------------------------------------------------------------------
create policy "task_tags_select_own"
  on public.task_tags for select
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_tags.task_id and p.user_id = auth.uid()
    )
  );

create policy "task_tags_insert_own"
  on public.task_tags for insert
  with check (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_tags.task_id and p.user_id = auth.uid()
    )
  );

create policy "task_tags_delete_own"
  on public.task_tags for delete
  using (
    exists (
      select 1
      from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_tags.task_id and p.user_id = auth.uid()
    )
  );
