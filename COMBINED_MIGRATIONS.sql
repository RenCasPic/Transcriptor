begin;

-- ============================================================
-- Migración: 0001_extensions_and_helpers.sql
-- ============================================================
-- Extensiones necesarias
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Función genérica para mantener updated_at al día en cualquier tabla que la use.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- Migración: 0002_profiles.sql
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());


-- ============================================================
-- Migración: 0003_workspaces.sql
-- ============================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);

alter table public.workspaces enable row level security;

create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);

alter table public.workspace_members enable row level security;

-- Funciones auxiliares SECURITY DEFINER para evitar recursión de RLS al
-- consultar la pertenencia a un workspace desde políticas de otras tablas.
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(p_workspace_id uuid, p_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

create policy "workspaces_select_members"
  on public.workspaces for select
  using (public.is_workspace_member(id));

create policy "workspaces_update_owner_admin"
  on public.workspaces for update
  using (public.has_workspace_role(id, array['owner', 'admin']))
  with check (public.has_workspace_role(id, array['owner', 'admin']));

create policy "workspaces_delete_owner"
  on public.workspaces for delete
  using (owner_id = auth.uid());

create policy "workspaces_insert_self"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

create policy "workspace_members_select_own_workspace"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_manage_owner_admin"
  on public.workspace_members for insert
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_update_owner_admin"
  on public.workspace_members for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_delete_owner_admin"
  on public.workspace_members for delete
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));


-- ============================================================
-- Migración: 0004_handle_new_user.sql
-- ============================================================
-- Al registrarse un usuario, crea automáticamente:
--   1. Su perfil.
--   2. Un workspace personal.
--   3. Su membresía como 'owner' de ese workspace.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_base_slug text;
  v_slug text;
  v_workspace_id uuid;
  v_suffix int := 0;
begin
  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name)
  values (new.id, v_full_name)
  on conflict (id) do nothing;

  v_base_slug := regexp_replace(lower(coalesce(v_full_name, 'workspace')), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'workspace';
  end if;
  v_slug := v_base_slug || '-' || substr(new.id::text, 1, 6);

  while exists (select 1 from public.workspaces where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || substr(new.id::text, 1, 6) || '-' || v_suffix;
  end loop;

  insert into public.workspaces (name, slug, owner_id)
  values (coalesce(v_full_name, 'Mi espacio de trabajo') || ' — Workspace', v_slug, new.id)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- Migración: 0005_projects.sql
-- ============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  name text not null,
  provisional_title text,
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
  status text not null default 'draft' check (
    status in ('draft', 'processing', 'review', 'ready', 'published', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_workspace_id_idx on public.projects (workspace_id);
create index projects_status_idx on public.projects (status);
create index projects_updated_at_idx on public.projects (updated_at desc);

alter table public.projects enable row level security;

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create policy "projects_select_members"
  on public.projects for select
  using (public.is_workspace_member(workspace_id));

create policy "projects_insert_editors"
  on public.projects for insert
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));

create policy "projects_update_editors"
  on public.projects for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor']));

create policy "projects_delete_owner_admin"
  on public.projects for delete
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));


-- ============================================================
-- Migración: 0006_project_helpers.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0007_media_sources_transcripts.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0008_content_documents.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0009_document_versions.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0010_content_source_links.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0011_content_warnings.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0012_seo_metadata.sql
-- ============================================================
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


-- ============================================================
-- Migración: 0013_generation_jobs.sql
-- ============================================================
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  job_type text not null check (
    job_type in ('generate_article', 'rewrite_section', 'generate_seo', 'transcribe')
  ),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  progress int not null default 0 check (progress between 0 and 100),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index generation_jobs_project_id_idx on public.generation_jobs (project_id, created_at desc);

alter table public.generation_jobs enable row level security;

create policy "generation_jobs_select_members"
  on public.generation_jobs for select
  using (public.is_project_member(project_id));

create policy "generation_jobs_insert_editors"
  on public.generation_jobs for insert
  with check (public.can_edit_project(project_id));

create policy "generation_jobs_update_editors"
  on public.generation_jobs for update
  using (public.can_edit_project(project_id));


-- ============================================================
-- Migración: 0014_integrations.sql
-- ============================================================
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('wordpress', 'webflow', 'ghost', 'youtube')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  -- Credenciales cifradas en el servidor (AES-GCM) antes de insertarse. Nunca se
  -- escriben ni se leen credenciales en texto plano desde el cliente.
  encrypted_credentials text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

alter table public.integrations enable row level security;

create trigger set_integrations_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

create policy "integrations_select_owner_admin"
  on public.integrations for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "integrations_insert_owner_admin"
  on public.integrations for insert
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "integrations_update_owner_admin"
  on public.integrations for update
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "integrations_delete_owner_admin"
  on public.integrations for delete
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));


-- ============================================================
-- Migración: 0015_storage.sql
-- ============================================================
-- Bucket privado para archivos importados (TXT/SRT/VTT y, en el futuro, audio/video).
-- El acceso siempre se hace mediante URLs firmadas generadas en el servidor;
-- el bucket NO es público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-sources',
  'project-sources',
  false,
  26214400, -- 25 MB
  array['text/plain', 'application/x-subrip', 'text/vtt', 'audio/mpeg', 'audio/mp4', 'video/mp4']
)
on conflict (id) do nothing;

-- Convención de rutas: {workspace_id}/{project_id}/{filename}
-- Esto permite que las políticas verifiquen membresía usando el primer segmento
-- del path como workspace_id.
create policy "project_sources_select_members"
  on storage.objects for select
  using (
    bucket_id = 'project-sources'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "project_sources_insert_editors"
  on storage.objects for insert
  with check (
    bucket_id = 'project-sources'
    and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'editor'])
  );

create policy "project_sources_delete_editors"
  on storage.objects for delete
  using (
    bucket_id = 'project-sources'
    and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'editor'])
  );


-- ============================================================
-- Migración: 0016_expand_media_mime_types.sql
-- ============================================================
-- Amplía los formatos aceptados por el bucket 'project-sources' para incluir
-- video y audio subidos directamente por el usuario (antes solo texto/mp4).
update storage.buckets
set allowed_mime_types = array[
  'text/plain',
  'application/x-subrip',
  'text/vtt',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/webm'
]
where id = 'project-sources';


commit;
