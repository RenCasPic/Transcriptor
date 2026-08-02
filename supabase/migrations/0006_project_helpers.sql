-- Funciones auxiliares para políticas RLS de tablas que cuelgan de un proyecto
-- (media_sources, transcripts, content_documents, generation_jobs, etc.).
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and public.is_workspace_member(p.workspace_id)
  );
$$;

create or replace function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and public.has_workspace_role(p.workspace_id, array['owner', 'admin', 'editor'])
  );
$$;

-- Idem para tablas que cuelgan de content_documents (document_versions,
-- content_source_links, content_warnings, seo_metadata).
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
