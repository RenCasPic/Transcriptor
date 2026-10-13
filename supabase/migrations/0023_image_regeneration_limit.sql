-- Límite de regeneraciones por imagen.
--
-- Cada vez que el usuario pulsa "Generar imagen" / "Generar otra" en el editor
-- se paga una generación con IA. Aquí se cuenta cuántas veces se ha generado
-- cada imagen (cada "hueco" del artículo: la portada o una imagen concreta del
-- cuerpo) para poder poner un tope. Las imágenes automáticas del primer
-- artículo NO cuentan: solo las generaciones hechas desde el editor.
--
-- image_key: 'cover' para la portada, o el id (uuid) de la imagen del cuerpo.

create table public.document_image_regenerations (
  document_id uuid not null references public.content_documents (id) on delete cascade,
  image_key text not null,
  count smallint not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (document_id, image_key)
);

alter table public.document_image_regenerations enable row level security;

create policy "image_regenerations_select_members"
  on public.document_image_regenerations for select
  using (public.is_document_member(document_id));

create policy "image_regenerations_insert_editors"
  on public.document_image_regenerations for insert
  with check (public.can_edit_document(document_id));

create policy "image_regenerations_update_editors"
  on public.document_image_regenerations for update
  using (public.can_edit_document(document_id));

create policy "image_regenerations_delete_editors"
  on public.document_image_regenerations for delete
  using (public.can_edit_document(document_id));

-- Reserva UNA generación de forma atómica. Devuelve el número de generaciones
-- usadas tras reservarla, o NULL si ya se alcanzó el límite (p_max).
-- Corre con los permisos de quien llama (RLS aplica).
create or replace function public.use_image_regeneration(
  p_document_id uuid,
  p_image_key text,
  p_max integer
)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into public.document_image_regenerations as r (document_id, image_key, count)
  values (p_document_id, p_image_key, 1)
  on conflict (document_id, image_key) do update
    set count = r.count + 1, updated_at = now()
    where r.count < p_max
  returning r.count into v_count;

  return v_count;
end;
$$;

-- Devuelve una generación reservada cuando la IA falló (un intento fallido no cuenta).
create or replace function public.release_image_regeneration(
  p_document_id uuid,
  p_image_key text
)
returns void
language sql
as $$
  update public.document_image_regenerations
     set count = greatest(count - 1, 0), updated_at = now()
   where document_id = p_document_id and image_key = p_image_key;
$$;
