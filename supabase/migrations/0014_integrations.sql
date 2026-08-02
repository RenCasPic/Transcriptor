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
