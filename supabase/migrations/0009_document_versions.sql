create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.content_documents (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  version_number int not null,
  title text not null default '',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text not null default '',
  reason text not null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index document_versions_document_id_idx on public.document_versions (document_id, version_number desc);

alter table public.document_versions enable row level security;

create policy "document_versions_select_members"
  on public.document_versions for select
  using (public.is_document_member(document_id));

create policy "document_versions_insert_editors"
  on public.document_versions for insert
  with check (public.can_edit_document(document_id));
