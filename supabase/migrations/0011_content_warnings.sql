create table public.content_warnings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.content_documents (id) on delete cascade,
  block_id text,
  warning_type text not null check (
    warning_type in (
      'unsupported_claim',
      'number_verification',
      'name_verification',
      'date_verification',
      'possible_hallucination',
      'missing_source'
    )
  ),
  message text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index content_warnings_document_id_idx on public.content_warnings (document_id, status);

alter table public.content_warnings enable row level security;

create policy "content_warnings_select_members"
  on public.content_warnings for select
  using (public.is_document_member(document_id));

create policy "content_warnings_insert_editors"
  on public.content_warnings for insert
  with check (public.can_edit_document(document_id));

create policy "content_warnings_update_editors"
  on public.content_warnings for update
  using (public.can_edit_document(document_id));

create policy "content_warnings_delete_editors"
  on public.content_warnings for delete
  using (public.can_edit_document(document_id));
