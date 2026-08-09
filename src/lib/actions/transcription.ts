'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { getTranscriptionProvider } from '@/lib/ai/transcription';
import { saveTranscript } from '@/lib/generation/save-transcript';
import { checkRateLimit } from '@/lib/rate-limit';
import { isUrlSafeToFetch } from '@/lib/security/url-safety';
import { MAX_MEDIA_BYTES } from '@/lib/media/limits';
import type { Database } from '@/lib/types/database';

const SIGNED_URL_TTL_SECONDS = 300;
const TRANSCRIPTION_RATE_LIMIT = 5;
const TRANSCRIPTION_RATE_WINDOW_SECONDS = 60 * 60;

const MEDIA_MIME_TO_SOURCE_TYPE: Record<string, 'audio' | 'video'> = {
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'audio/wav': 'audio',
  'audio/webm': 'audio',
};

interface TranscribeCoreParams {
  projectId: string;
  sourceType: 'audio' | 'video';
  storagePath: string;
  originalFilename: string | null;
  sourceUrl: string | null;
  language: string;
  userId: string;
}

/**
 * Lógica compartida: crea el media_source, transcribe con el proveedor
 * configurado y guarda la transcripción. Se usa tanto para archivos subidos
 * manualmente como para archivos descargados desde un enlace directo.
 */
async function transcribeCore(
  supabase: SupabaseClient<Database>,
  params: TranscribeCoreParams,
): Promise<ActionResult<{ transcriptId: string }>> {
  const rateLimit = checkRateLimit(
    `transcribe-media:${params.userId}`,
    TRANSCRIPTION_RATE_LIMIT,
    TRANSCRIPTION_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return err(
      'RATE_LIMITED',
      `Alcanzaste el límite de transcripciones. Inténtalo de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutos.`,
    );
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', params.projectId)
    .maybeSingle();
  if (!project) {
    return err('NOT_FOUND', 'Proyecto no encontrado.');
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: params.projectId,
      source_type: params.sourceType,
      original_filename: params.originalFilename,
      storage_path: params.storagePath,
      source_url: params.sourceUrl,
    })
    .select('id')
    .single();

  if (sourceError || !source) {
    return err('CREATE_SOURCE_ERROR', 'No se pudo registrar el archivo.');
  }

  const { data: job } = await supabase
    .from('generation_jobs')
    .insert({
      project_id: params.projectId,
      job_type: 'transcribe',
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  await supabase.from('projects').update({ status: 'processing' }).eq('id', params.projectId);

  try {
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('project-sources')
      .createSignedUrl(params.storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedUrlError || !signedUrlData) {
      throw new Error('SIGNED_URL_ERROR');
    }

    const provider = getTranscriptionProvider();
    const result = await provider.transcribe({
      mediaUrl: signedUrlData.signedUrl,
      fileExtension: params.storagePath.split('.').pop(),
      language: params.language,
    });

    const saved = await saveTranscript(supabase, {
      projectId: params.projectId,
      sourceId: source.id,
      language: params.language,
      fullText: result.fullText,
      segments: result.segments.map((s) => ({
        index: s.index,
        speaker: s.speaker,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        text: s.text,
      })),
    });

    if ('error' in saved) {
      throw new Error(saved.error);
    }

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    await supabase.from('projects').update({ status: 'draft' }).eq('id', params.projectId);

    revalidatePath(`/projects/${params.projectId}`);
    return ok({ transcriptId: saved.transcriptId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TRANSCRIPTION_FAILED';

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    await supabase.from('projects').update({ status: 'failed' }).eq('id', params.projectId);

    return err('TRANSCRIPTION_FAILED', translateTranscriptionError(message));
  }
}

const TranscribeMediaSchema = z.object({
  projectId: z.string().uuid(),
  sourceType: z.enum(['audio', 'video']),
  storagePath: z.string().min(1),
  originalFilename: z.string().min(1),
  language: z.string().min(2).max(10).default('es'),
});

export type TranscribeMediaInput = z.infer<typeof TranscribeMediaSchema>;

/**
 * Transcribe un archivo de audio/video ya subido a Storage (subida manual
 * desde el navegador) usando el proveedor de transcripción configurado.
 */
export async function transcribeMediaAction(
  input: TranscribeMediaInput,
): Promise<ActionResult<{ transcriptId: string }>> {
  const parsed = TranscribeMediaSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  return transcribeCore(supabase, {
    projectId: parsed.data.projectId,
    sourceType: parsed.data.sourceType,
    storagePath: parsed.data.storagePath,
    originalFilename: parsed.data.originalFilename,
    sourceUrl: null,
    language: parsed.data.language,
    userId: user.id,
  });
}

const ImportMediaFromUrlSchema = z.object({
  projectId: z.string().uuid(),
  sourceUrl: z.string().url('Ingresa una URL válida'),
  language: z.string().min(2).max(10).default('es'),
});

export type ImportMediaFromUrlInput = z.infer<typeof ImportMediaFromUrlSchema>;

/**
 * Descarga un archivo de audio/video desde un enlace directo (por ejemplo,
 * un link de descarga directa de Drive/Dropbox o un CDN propio), lo sube a
 * Storage y lo transcribe. NO soporta YouTube ni otras plataformas de
 * streaming: eso requeriría descargar contenido sin autorización, fuera de
 * los términos de servicio de esos sitios. Solo acepta URLs que resuelvan
 * directamente a un archivo de audio/video (Content-Type real).
 */
export async function importMediaFromUrlAction(
  input: ImportMediaFromUrlInput,
): Promise<ActionResult<{ transcriptId: string }>> {
  const parsed = ImportMediaFromUrlSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  if (!isUrlSafeToFetch(parsed.data.sourceUrl)) {
    return err('UNSAFE_URL', 'Esa URL no es válida o no está permitida.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const rateLimit = checkRateLimit(
    `import-media-url:${user.id}`,
    TRANSCRIPTION_RATE_LIMIT,
    TRANSCRIPTION_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return err(
      'RATE_LIMITED',
      `Alcanzaste el límite de transcripciones. Inténtalo de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutos.`,
    );
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();
  if (!project) {
    return err('NOT_FOUND', 'Proyecto no encontrado.');
  }

  let response: Response;
  try {
    response = await fetch(parsed.data.sourceUrl, { redirect: 'follow' });
  } catch {
    return err('FETCH_ERROR', 'No se pudo acceder a esa URL.');
  }

  if (!response.ok || !response.body) {
    return err('FETCH_ERROR', 'No se pudo descargar el archivo desde esa URL.');
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const sourceType = MEDIA_MIME_TO_SOURCE_TYPE[contentType];
  if (!sourceType) {
    return err(
      'UNSUPPORTED_CONTENT_TYPE',
      'La URL no apunta directamente a un archivo de audio/video soportado (mp4, mov, webm, mp3, wav, m4a). Los enlaces de YouTube u otras plataformas de streaming no son compatibles.',
    );
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > MAX_MEDIA_BYTES) {
    return err('TRANSCRIPTION_FILE_TOO_LARGE_URL', 'El archivo supera el límite de 25 MB permitido.');
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
    return err('TRANSCRIPTION_FILE_TOO_LARGE_URL', 'El archivo supera el límite de 25 MB permitido.');
  }

  const extension = sourceType === 'video' ? 'mp4' : 'mp3';
  const storagePath = `${project.workspace_id}/${parsed.data.projectId}/${Date.now()}-remote.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('project-sources')
    .upload(storagePath, arrayBuffer, { contentType });

  if (uploadError) {
    return err('UPLOAD_ERROR', 'No se pudo guardar el archivo descargado.');
  }

  return transcribeCore(supabase, {
    projectId: parsed.data.projectId,
    sourceType,
    storagePath,
    originalFilename: null,
    sourceUrl: parsed.data.sourceUrl,
    language: parsed.data.language,
    userId: user.id,
  });
}

function translateTranscriptionError(message: string): string {
  if (message === 'TRANSCRIPTION_FILE_TOO_LARGE') {
    return 'El archivo supera el límite de 25 MB permitido para transcripción.';
  }
  if (message === 'TRANSCRIPTION_SOURCE_FETCH_FAILED' || message === 'SIGNED_URL_ERROR') {
    return 'No se pudo acceder al archivo subido. Inténtalo de nuevo.';
  }
  if (message === 'EMPTY_TRANSCRIPT') {
    return 'No se detectó voz en el archivo. Verifica que tenga audio.';
  }
  if (message.startsWith('TRANSCRIPTION_PROVIDER_HTTP_ERROR')) {
    return 'El servicio de transcripción no pudo procesar el archivo. Inténtalo de nuevo.';
  }
  return 'No se pudo transcribir el archivo. Inténtalo de nuevo.';
}
