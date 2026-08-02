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

-- Las funciones auxiliares para content_documents (is_document_member,
-- can_edit_document) se definen en 0008_content_documents.sql, después de
-- crear esa tabla, ya que la referencian directamente.
