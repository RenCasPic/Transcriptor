-- Imágenes de artículos (generadas con IA o subidas por el usuario).
--
-- 1) Bucket PÚBLICO `article-images`: las imágenes se muestran en el editor, en
--    la vista previa y en la página pública /embed, así que se sirven por su URL
--    pública (sin firmar). Lo que NO es público es la escritura: cada workspace
--    solo puede crear/modificar/borrar archivos bajo su propia carpeta.
--    Convención de rutas: {workspace_id}/{project_id}/{archivo}
-- 2) projects.image_mode: qué imágenes generar al crear el artículo.
-- 3) content_documents.cover_image_prompt: descripción con la que se generó la
--    portada (para poder regenerarla editando el texto).
-- 4) content_warnings: nuevo tipo 'image_generation' (avisos de imágenes que no
--    se pudieron generar).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: el bucket es público (la URL pública no pasa por RLS). Esta política
-- solo permite a los miembros listar/consultar los objetos de su workspace.
create policy "article_images_select_members"
  on storage.objects for select
  using (
    bucket_id = 'article-images'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "article_images_insert_editors"
  on storage.objects for insert
  with check (
    bucket_id = 'article-images'
    and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'editor'])
  );

create policy "article_images_update_editors"
  on storage.objects for update
  using (
    bucket_id = 'article-images'
    and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'editor'])
  );

create policy "article_images_delete_editors"
  on storage.objects for delete
  using (
    bucket_id = 'article-images'
    and public.has_workspace_role((storage.foldername(name))[1]::uuid, array['owner', 'admin', 'editor'])
  );

-- Opción "Imágenes" al crear el artículo.
alter table public.projects
  add column if not exists image_mode text not null default 'cover_and_inline';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_image_mode_check'
  ) then
    alter table public.projects
      add constraint projects_image_mode_check
      check (image_mode in ('none', 'cover', 'cover_and_inline'));
  end if;
end $$;

alter table public.content_documents
  add column if not exists cover_image_prompt text;

-- Nuevo tipo de alerta: 'image_generation'.
alter table public.content_warnings
  drop constraint if exists content_warnings_warning_type_check;

alter table public.content_warnings
  add constraint content_warnings_warning_type_check check (
    warning_type in (
      'unsupported_claim',
      'number_verification',
      'name_verification',
      'date_verification',
      'possible_hallucination',
      'missing_source',
      'image_generation'
    )
  );
