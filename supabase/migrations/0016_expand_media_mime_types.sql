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
