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
