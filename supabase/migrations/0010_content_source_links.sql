create table public.content_source_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.content_documents (id) on delete cascade,
  block_id text not null,
  transcript_segment_id uuid not null references public.transcript_segments (id) on delete cascade,
  relevance_score numeric,
  created_at timestamptz not null default now()
);

create index content_source_links_document_id_idx on public.content_source_links (document_id, block_id);
create index content_source_links_segment_id_idx on public.content_source_links (transcript_segment_id);

alter table public.content_source_links enable row level security;

create policy "content_source_links_select_members"
  on public.content_source_links for select
  using (public.is_document_member(document_id));

create policy "content_source_links_insert_editors"
  on public.content_source_links for insert
  with check (public.can_edit_document(document_id));

create policy "content_source_links_delete_editors"
  on public.content_source_links for delete
  using (public.can_edit_document(document_id));
