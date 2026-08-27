-- Archivos de audio/video grandes: se suben directo del navegador a Storage
-- (signed upload URL) y se transcriben en segundo plano vía generation_jobs.
--
-- 1) Subir el límite de tamaño del bucket y ampliar los formatos aceptados.
--    OJO: el límite EFECTIVO también depende del límite global de Storage del
--    proyecto Supabase (Dashboard → Storage → Settings → "Upload file size
--    limit", o `[storage] file_size_limit` en supabase/config.toml para local).
--    Este valor (500 MB) es el tope de la app; súbelo también a nivel global
--    si tu plan lo permite.
update storage.buckets
set
  file_size_limit = 524288000, -- 500 MB
  allowed_mime_types = array[
    -- texto / subtítulos (import de transcripción)
    'text/plain',
    'application/x-subrip',
    'text/vtt',
    -- audio
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/webm',
    'audio/ogg',
    'application/ogg',
    'audio/aac',
    'audio/x-aac',
    'audio/flac',
    'audio/x-flac',
    -- video
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v'
  ]
where id = 'project-sources';

-- 2) Índice para el drenado de jobs de transcripción encolados/colgados
--    (Route Handler /api/jobs/transcription y retomado de jobs "processing").
create index if not exists generation_jobs_transcribe_status_idx
  on public.generation_jobs (job_type, status, created_at);
