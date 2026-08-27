-- Archivos de audio/video grandes: se suben directo del navegador a Storage
-- (signed upload URL) y se transcriben en segundo plano vía generation_jobs.
--
-- 1) Quitar el límite de tamaño A NIVEL DE BUCKET y ampliar los formatos.
--    file_size_limit = NULL => el bucket hereda el límite GLOBAL del proyecto
--    Supabase (Dashboard → Storage → Settings → "Upload file size limit"; en el
--    plan gratuito son 50 MB y no se puede subir, en planes de pago hasta 50 GB).
--    El tope de la APP se controla aparte con MEDIA_MAX_UPLOAD_MB; el límite
--    efectivo es el menor de los dos. Poner aquí un número mayor que el global
--    haría que Storage rechazara la propia migración (413), así que se deja en
--    NULL y manda la configuración del proyecto.
update storage.buckets
set
  file_size_limit = null,
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
