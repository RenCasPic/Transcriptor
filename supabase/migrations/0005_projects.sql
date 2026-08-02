create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  name text not null,
  provisional_title text,
  content_type text not null check (
    content_type in ('tutorial', 'guide', 'list', 'interview', 'summary', 'case_study', 'opinion', 'qa')
  ),
  audience text,
  tone text not null default 'professional' check (
    tone in ('professional', 'educational', 'conversational', 'persuasive', 'technical', 'friendly')
  ),
  language text not null default 'es',
  primary_keyword text,
  objective text,
  call_to_action text,
  status text not null default 'draft' check (
    status in ('draft', 'processing', 'review', 'ready', 'published', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_workspace_id_idx on public.projects (workspace_id);
create index projects_status_idx on public.projects (status);
create index projects_updated_at_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create policy "projects_select_members"
  on public.projects for select
  using (public.is_workspace_member(workspace_id));

create policy "projects_insert_editors"
  on public.projects for insert
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));

create policy "projects_update_editors"
  on public.projects for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));

create policy "projects_delete_owner_admin"
  on public.projects for delete
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));
