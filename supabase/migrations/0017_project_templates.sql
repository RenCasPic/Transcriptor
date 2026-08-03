-- Plantillas de configuración de proyecto: permiten guardar audiencia, tono,
-- tipo de contenido, etc. y reutilizarlas al crear nuevos proyectos sin
-- volver a escribirlas cada vez.
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_templates_workspace_id_idx on public.project_templates (workspace_id, created_at desc);

alter table public.project_templates enable row level security;

create trigger set_project_templates_updated_at
  before update on public.project_templates
  for each row execute function public.set_updated_at();

create policy "project_templates_select_members"
  on public.project_templates for select
  using (public.is_workspace_member(workspace_id));

create policy "project_templates_insert_editors"
  on public.project_templates for insert
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));

create policy "project_templates_update_editors"
  on public.project_templates for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));

create policy "project_templates_delete_editors"
  on public.project_templates for delete
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));
