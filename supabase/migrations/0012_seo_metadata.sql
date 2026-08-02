create table public.seo_metadata (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.content_documents (id) on delete cascade,
  seo_title text,
  slug text,
  meta_description text,
  primary_keyword text,
  secondary_keywords text[] not null default array[]::text[],
  structured_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index seo_metadata_document_id_idx on public.seo_metadata (document_id);

alter table public.seo_metadata enable row level security;

create trigger set_seo_metadata_updated_at
  before update on public.seo_metadata
  for each row execute function public.set_updated_at();

create policy "seo_metadata_select_members"
  on public.seo_metadata for select
  using (public.is_document_member(document_id));

create policy "seo_metadata_insert_editors"
  on public.seo_metadata for insert
  with check (public.can_edit_document(document_id));

create policy "seo_metadata_update_editors"
  on public.seo_metadata for update
  using (public.can_edit_document(document_id));
