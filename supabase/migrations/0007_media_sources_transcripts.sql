create table public.media_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_type text not null check (
    source_type in ('manual', 'txt', 'srt', 'vtt', 'audio', 'video', 'youtube')
  ),
  original_filename text,
  storage_path text,
  source_url text,
  duration_seconds numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index media_sources_project_id_idx on public.media_sources (project_id);

alter table public.media_sources enable row level security;

create policy "media_sources_select_members"
  on public.media_sources for select
  using (public.is_project_member(project_id));

create policy "media_sources_write_editors"
  on public.media_sources for insert
  with check (public.can_edit_project(project_id));

create policy "media_sources_update_editors"
  on public.media_sources for update
  using (public.can_edit_project(project_id));

create policy "media_sources_delete_editors"
  on public.media_sources for delete
  using (public.can_edit_project(project_id));

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid references public.media_sources (id) on delete set null,
  language text not null default 'es',
  full_text text not null,
  status text not null default 'ready' check (
    status in ('pending', 'processing', 'ready', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transcripts_project_id_idx on public.transcripts (project_id);

alter table public.transcripts enable row level security;

create trigger set_transcripts_updated_at
  before update on public.transcripts
  for each row execute function public.set_updated_at();

create policy "transcripts_select_members"
  on public.transcripts for select
  using (public.is_project_member(project_id));

create policy "transcripts_insert_editors"
  on public.transcripts for insert
  with check (public.can_edit_project(project_id));

create policy "transcripts_update_editors"
  on public.transcripts for update
  using (public.can_edit_project(project_id));

create policy "transcripts_delete_editors"
  on public.transcripts for delete
  using (public.can_edit_project(project_id));

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts (id) on delete cascade,
  segment_index int not null,
  speaker text,
  start_seconds numeric,
  end_seconds numeric,
  text text not null,
  confidence numeric,
  created_at timestamptz not null default now(),
  unique (transcript_id, segment_index)
);

create index transcript_segments_transcript_id_idx on public.transcript_segments (transcript_id);

alter table public.transcript_segments enable row level security;

create or replace function public.is_transcript_member(p_transcript_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.transcripts t
    where t.id = p_transcript_id and public.is_project_member(t.project_id)
  );
$$;

create or replace function public.can_edit_transcript(p_transcript_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.transcripts t
    where t.id = p_transcript_id and public.can_edit_project(t.project_id)
  );
$$;

create policy "transcript_segments_select_members"
  on public.transcript_segments for select
  using (public.is_transcript_member(transcript_id));

create policy "transcript_segments_insert_editors"
  on public.transcript_segments for insert
  with check (public.can_edit_transcript(transcript_id));

create policy "transcript_segments_update_editors"
  on public.transcript_segments for update
  using (public.can_edit_transcript(transcript_id));

create policy "transcript_segments_delete_editors"
  on public.transcript_segments for delete
  using (public.can_edit_transcript(transcript_id));
