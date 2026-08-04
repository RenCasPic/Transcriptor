-- Permite marcar un content_document como público para poder insertarlo
-- (iframe) o enlazarlo directamente en sitios externos, sin exponer el resto
-- del workspace/proyecto. El acceso público es de solo lectura y se activa
-- explícitamente desde el editor (ver setDocumentPublicAction).

alter table public.content_documents
  add column is_public boolean not null default false,
  add column published_at timestamptz;

create or replace function public.is_document_public(p_document_id uuid)
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
      and d.is_public = true
  );
$$;

create policy "content_documents_select_public"
  on public.content_documents for select
  using (is_public = true);

create policy "seo_metadata_select_public"
  on public.seo_metadata for select
  using (public.is_document_public(document_id));
