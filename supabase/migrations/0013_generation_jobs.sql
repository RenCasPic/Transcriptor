create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  job_type text not null check (
    job_type in ('generate_article', 'rewrite_section', 'generate_seo', 'transcribe')
  ),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  progress int not null default 0 check (progress between 0 and 100),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index generation_jobs_project_id_idx on public.generation_jobs (project_id, created_at desc);

alter table public.generation_jobs enable row level security;

create policy "generation_jobs_select_members"
  on public.generation_jobs for select
  using (public.is_project_member(project_id));

create policy "generation_jobs_insert_editors"
  on public.generation_jobs for insert
  with check (public.can_edit_project(project_id));

create policy "generation_jobs_update_editors"
  on public.generation_jobs for update
  using (public.can_edit_project(project_id));
