create table public.content_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null default '',
  excerpt text,
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  content_markdown text not null default '',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved')),
  word_count int not null default 0,
  reading_time_minutes int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index content_documents_project_id_idx on public.content_documents (project_id);

alter table public.content_documents enable row level security;

create trigger set_content_documents_updated_at
  before update on public.content_documents
  for each row execute function public.set_updated_at();

create policy "content_documents_select_members"
  on public.content_documents for select
  using (public.is_project_member(project_id));

create policy "content_documents_insert_editors"
  on public.content_documents for insert
  with check (public.can_edit_project(project_id));

create policy "content_documents_update_editors"
  on public.content_documents for update
  using (public.can_edit_project(project_id));

create policy "content_documents_delete_editors"
  on public.content_documents for delete
  using (public.can_edit_project(project_id));

-- Funciones auxiliares para tablas que cuelgan de content_documents
-- (document_versions, content_source_links, content_warnings, seo_metadata).
create or replace function public.is_document_member(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.content_documents d
    where d.id = p_document_id
      and public.is_project_member(d.project_id)
  );
$$;

create or replace function public.can_edit_document(p_document_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.content_documents d
    where d.id = p_document_id
      and public.can_edit_project(d.project_id)
  );
$$;
