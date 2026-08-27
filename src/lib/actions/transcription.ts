'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { checkRateLimit } from '@/lib/rate-limit';
import { isUrlSafeToFetch } from '@/lib/security/url-safety';
import { getMediaLimits } from '@/lib/media/limits';
import {
  extensionOf,
  mediaFormatForExtension,
  SUPPORTED_MEDIA_FORMATS,
  validateMediaUpload,
} from '@/lib/media/formats';
import { translateMediaError } from '@/lib/actions/media-errors';
import { processTranscriptionJob } from '@/lib/generation/transcription-job-runner';

const STORAGE_BUCKET = 'project-sources';
const ENQUEUE_RATE_LIMIT = 10;
const ENQUEUE_RATE_WINDOW_SECONDS = 60 * 60;

function limitsContext() {
  const limits = getMediaLimits();
  return {
    maxUploadMb: Math.round(limits.maxUploadBytes / (1024 * 1024)),
    maxDurationMinutes: Math.round(limits.maxDurationSeconds / 60),
  };
}

// ---------------------------------------------------------------------------
// 1. Preparar la subida directa navegador → Supabase Storage
// ---------------------------------------------------------------------------

const CreateUploadUrlSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1).max(300),
  contentType: z.string().max(150).nullable().default(null),
  sizeBytes: z.number().int().positive(),
});

export type CreateMediaUploadUrlInput = z.input<typeof CreateUploadUrlSchema>;

export interface MediaUploadTarget {
  bucket: string;
  path: string;
  token: string;
  /** URL absoluta a la que hacer PUT del archivo (permite medir progreso con XHR). */
  uploadUrl: string;
}

/**
 * Devuelve una signed upload URL para que el navegador suba el archivo
 * DIRECTAMENTE a Supabase Storage, sin que los bytes pasen por una Server
 * Action ni por el límite de payload de Next.js. La ruta del objeto la elige
 * el servidor (`{workspace_id}/{project_id}/{uuid}.{ext}`): el cliente no puede
 * escribir en la carpeta de otro workspace, y además la política RLS de
 * `storage.objects` exige rol de edición en ese workspace para crear la URL.
 */
export async function createMediaUploadUrlAction(
  input: CreateMediaUploadUrlInput,
): Promise<ActionResult<MediaUploadTarget>> {
  const parsed = CreateUploadUrlSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const limits = getMediaLimits();
  const validation = validateMediaUpload({
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    sizeBytes: parsed.data.sizeBytes,
    maxUploadBytes: limits.maxUploadBytes,
  });
  if (!validation.ok) {
    return err(validation.code, translateMediaError(validation.code, limitsContext()));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHENTICATED', 'Debes iniciar sesión.');

  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();
  if (!project) return err('NOT_FOUND', 'Proyecto no encontrado.');

  const path = `${project.workspace_id}/${project.id}/${randomUUID()}.${validation.extension}`;

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return err('MEDIA_UPLOAD_URL_FAILED', translateMediaError('MEDIA_UPLOAD_URL_FAILED', limitsContext()));
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const uploadUrl = data.signedUrl.startsWith('http') ? data.signedUrl : `${base}${data.signedUrl}`;

  return ok({ bucket: STORAGE_BUCKET, path: data.path, token: data.token, uploadUrl });
}

// ---------------------------------------------------------------------------
// 2. Encolar la transcripción de un archivo ya subido a Storage
// ---------------------------------------------------------------------------

const EnqueueSchema = z.object({
  projectId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  originalFilename: z.string().min(1).max(300),
  contentType: z.string().max(150).nullable().default(null),
  language: z.string().min(2).max(10).default('es'),
  autoGenerate: z.boolean().default(true),
});

export type EnqueueMediaTranscriptionInput = z.input<typeof EnqueueSchema>;

export interface EnqueuedJob {
  jobId: string;
  mediaSourceId: string;
}

/**
 * Registra el archivo subido como `media_source` y encola un job de
 * transcripción (`generation_jobs`, estado `queued`). El procesamiento pesado
 * (descarga, extracción de audio, troceado, transcripción, generación) ocurre
 * en segundo plano vía `after()` — la Server Action responde de inmediato con
 * el `jobId` para que la UI consulte el progreso. Un worker/cron puede drenar
 * los jobs `queued` a través de `POST /api/jobs/transcription` sin cambiar
 * nada de esto.
 */
export async function enqueueMediaTranscriptionAction(
  input: EnqueueMediaTranscriptionInput,
): Promise<ActionResult<EnqueuedJob>> {
  const parsed = EnqueueSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const ctx = limitsContext();
  const limits = getMediaLimits();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHENTICATED', 'Debes iniciar sesión.');

  const rateLimit = checkRateLimit(`enqueue-transcription:${user.id}`, ENQUEUE_RATE_LIMIT, ENQUEUE_RATE_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return err('RATE_LIMITED', translateMediaError('RATE_LIMITED', ctx));
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();
  if (!project) return err('NOT_FOUND', 'Proyecto no encontrado.');

  // Ownership del archivo: la ruta DEBE estar dentro de la carpeta del
  // workspace + proyecto (la misma convención que valida la RLS de Storage).
  const expectedPrefix = `${project.workspace_id}/${project.id}/`;
  if (!parsed.data.storagePath.startsWith(expectedPrefix) || parsed.data.storagePath.includes('..')) {
    return err('MEDIA_OBJECT_NOT_FOUND', translateMediaError('MEDIA_OBJECT_NOT_FOUND', ctx));
  }

  // El objeto tiene que existir de verdad (no confiar en que el cliente lo
  // subió) y su tamaño real se re-valida en servidor.
  const dir = parsed.data.storagePath.split('/').slice(0, -1).join('/');
  const name = parsed.data.storagePath.split('/').pop() ?? '';
  const { data: listed } = await supabase.storage.from(STORAGE_BUCKET).list(dir, { search: name });
  const object = listed?.find((item) => item.name === name);
  if (!object) {
    return err('MEDIA_OBJECT_NOT_FOUND', translateMediaError('MEDIA_OBJECT_NOT_FOUND', ctx));
  }
  const sizeBytes = Number(object.metadata?.size ?? 0);

  const validation = validateMediaUpload({
    filename: parsed.data.originalFilename,
    contentType: parsed.data.contentType,
    sizeBytes: sizeBytes || 1,
    maxUploadBytes: limits.maxUploadBytes,
  });
  if (!validation.ok) {
    // El archivo subido no sirve: se borra para no dejar basura en el bucket.
    await supabase.storage.from(STORAGE_BUCKET).remove([parsed.data.storagePath]);
    return err(validation.code, translateMediaError(validation.code, ctx));
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: project.id,
      source_type: validation.sourceType,
      original_filename: parsed.data.originalFilename,
      storage_path: parsed.data.storagePath,
    })
    .select('id')
    .single();
  if (sourceError || !source) {
    return err('CREATE_SOURCE_ERROR', 'No se pudo registrar el archivo.');
  }

  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .insert({
      project_id: project.id,
      job_type: 'transcribe',
      status: 'queued',
      progress: 0,
      input: {
        mediaSourceId: source.id,
        language: parsed.data.language,
        autoGenerate: parsed.data.autoGenerate,
      },
      output: { stage: 'preparing', progress: 0 },
    })
    .select('id')
    .single();
  if (jobError || !job) {
    return err('CREATE_JOB_ERROR', 'No se pudo encolar el procesamiento.');
  }

  await supabase.from('projects').update({ status: 'processing' }).eq('id', project.id);
  revalidatePath(`/projects/${project.id}`);

  after(() =>
    processTranscriptionJob(job.id, project.id).catch((error) => {
      console.error('transcription job crashed', job.id, error);
    }),
  );

  return ok({ jobId: job.id, mediaSourceId: source.id });
}

// ---------------------------------------------------------------------------
// 3. Importar desde un enlace directo (Drive/Dropbox/CDN) — también asíncrono
// ---------------------------------------------------------------------------

const MEDIA_MIME_TO_SOURCE_TYPE: Record<string, 'audio' | 'video'> = Object.fromEntries(
  SUPPORTED_MEDIA_FORMATS.flatMap((f) => f.mimeTypes.map((mime) => [mime, f.sourceType] as const)),
);

const ImportMediaFromUrlSchema = z.object({
  projectId: z.string().uuid(),
  sourceUrl: z.string().url('Ingresa una URL válida'),
  language: z.string().min(2).max(10).default('es'),
  autoGenerate: z.boolean().default(true),
});

export type ImportMediaFromUrlInput = z.input<typeof ImportMediaFromUrlSchema>;

/**
 * Descarga diferida: en vez de traer el archivo dentro de la Server Action
 * (que lo cargaría entero y podría exceder el timeout), valida la URL y encola
 * un job. El procesador hace el streaming del archivo desde `source_url`
 * directamente hacia el troceador, sin cargarlo completo en memoria. NO
 * soporta YouTube ni plataformas de streaming.
 */
export async function importMediaFromUrlAction(
  input: ImportMediaFromUrlInput,
): Promise<ActionResult<EnqueuedJob>> {
  const parsed = ImportMediaFromUrlSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const ctx = limitsContext();
  const limits = getMediaLimits();

  if (!isUrlSafeToFetch(parsed.data.sourceUrl)) {
    return err('UNSAFE_URL', translateMediaError('UNSAFE_URL', ctx));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHENTICATED', 'Debes iniciar sesión.');

  const rateLimit = checkRateLimit(`import-media-url:${user.id}`, ENQUEUE_RATE_LIMIT, ENQUEUE_RATE_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return err('RATE_LIMITED', translateMediaError('RATE_LIMITED', ctx));
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();
  if (!project) return err('NOT_FOUND', 'Proyecto no encontrado.');

  let head: Response;
  try {
    head = await fetch(parsed.data.sourceUrl, { method: 'HEAD', redirect: 'follow' });
  } catch {
    return err('MEDIA_ACCESS_FAILED', translateMediaError('MEDIA_ACCESS_FAILED', ctx));
  }

  const contentType = head.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const urlExtension = extensionOf(new URL(parsed.data.sourceUrl).pathname);
  const sourceType =
    MEDIA_MIME_TO_SOURCE_TYPE[contentType] ?? mediaFormatForExtension(urlExtension)?.sourceType;
  if (!sourceType) {
    return err('UNSUPPORTED_CONTENT_TYPE', translateMediaError('UNSUPPORTED_CONTENT_TYPE', ctx));
  }

  const contentLength = Number(head.headers.get('content-length') ?? '0');
  if (contentLength > limits.maxUploadBytes) {
    return err('MEDIA_FILE_TOO_LARGE', translateMediaError('MEDIA_FILE_TOO_LARGE', ctx));
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: project.id,
      source_type: sourceType,
      source_url: parsed.data.sourceUrl,
      original_filename: urlExtension ? `remote.${urlExtension}` : null,
    })
    .select('id')
    .single();
  if (sourceError || !source) {
    return err('CREATE_SOURCE_ERROR', 'No se pudo registrar el enlace.');
  }

  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .insert({
      project_id: project.id,
      job_type: 'transcribe',
      status: 'queued',
      progress: 0,
      input: {
        mediaSourceId: source.id,
        language: parsed.data.language,
        autoGenerate: parsed.data.autoGenerate,
      },
      output: { stage: 'preparing', progress: 0 },
    })
    .select('id')
    .single();
  if (jobError || !job) {
    return err('CREATE_JOB_ERROR', 'No se pudo encolar el procesamiento.');
  }

  await supabase.from('projects').update({ status: 'processing' }).eq('id', project.id);
  revalidatePath(`/projects/${project.id}`);

  after(() =>
    processTranscriptionJob(job.id, project.id).catch((error) => {
      console.error('transcription job crashed', job.id, error);
    }),
  );

  return ok({ jobId: job.id, mediaSourceId: source.id });
}
