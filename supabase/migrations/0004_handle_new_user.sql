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
