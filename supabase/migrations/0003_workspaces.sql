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
