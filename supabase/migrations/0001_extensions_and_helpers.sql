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
