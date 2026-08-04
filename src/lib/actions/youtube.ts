'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { checkRateLimit } from '@/lib/rate-limit';
import { saveTranscript } from '@/lib/generation/save-transcript';
import { extractYoutubeVideoId, fetchYoutubeTranscript } from '@/lib/integrations/youtube-transcript';

const IMPORT_RATE_LIMIT = 5;
const IMPORT_RATE_WINDOW_SECONDS = 60 * 60;

const ImportYoutubeVideoSchema = z.object({
  projectId: z.string().uuid(),
  videoUrl: z.string().url('Ingresa una URL válida'),
  language: z.string().min(2).max(10).default('es'),
});

export type ImportYoutubeVideoInput = z.infer<typeof ImportYoutubeVideoSchema>;

/**
 * Importa los subtítulos de un video de YouTube (propio o ajeno, siempre que
 * sea público y tenga subtítulos) a partir de su URL, usando
 * `fetchYoutubeTranscript` (sin OAuth, ver ese módulo para el trade-off).
 * No descarga ni transcribe el audio/video real: si el video no tiene
 * subtítulos, se le pide al usuario que lo suba manualmente.
 */
export async function importYoutubeVideoAction(
  input: ImportYoutubeVideoInput,
): Promise<ActionResult<{ transcriptId: string; title: string }>> {
  const parsed = ImportYoutubeVideoSchema.safeParse(input);
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

  const videoId = extractYoutubeVideoId(parsed.data.videoUrl);
  if (!videoId) {
    return err('INVALID_YOUTUBE_URL', 'Esa no parece ser una URL de YouTube válida.');
  }

  const rateLimit = checkRateLimit(
    `import-youtube:${user.id}`,
    IMPORT_RATE_LIMIT,
    IMPORT_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return err(
      'RATE_LIMITED',
      `Alcanzaste el límite de importaciones. Inténtalo de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutos.`,
    );
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();
  if (!project) {
    return err('NOT_FOUND', 'Proyecto no encontrado.');
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: parsed.data.projectId,
      source_type: 'youtube',
      original_filename: null,
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      metadata: { videoId },
    })
    .select('id')
    .single();

  if (sourceError || !source) {
    return err('CREATE_SOURCE_ERROR', 'No se pudo registrar el video.');
  }

  const { data: job } = await supabase
    .from('generation_jobs')
    .insert({
      project_id: parsed.data.projectId,
      job_type: 'transcribe',
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  await supabase.from('projects').update({ status: 'processing' }).eq('id', parsed.data.projectId);

  try {
    const transcript = await fetchYoutubeTranscript(videoId, parsed.data.language);

    const saved = await saveTranscript(supabase, {
      projectId: parsed.data.projectId,
      sourceId: source.id,
      language: parsed.data.language,
      fullText: transcript.fullText,
      segments: transcript.segments,
    });

    if ('error' in saved) {
      throw new Error(saved.error);
    }

    await supabase.from('media_sources').update({ metadata: { videoId, title: transcript.title } }).eq('id', source.id);

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    await supabase.from('projects').update({ status: 'draft' }).eq('id', parsed.data.projectId);

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok({ transcriptId: saved.transcriptId, title: transcript.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'YOUTUBE_IMPORT_FAILED';

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    await supabase.from('projects').update({ status: 'failed' }).eq('id', parsed.data.projectId);

    return err('YOUTUBE_IMPORT_FAILED', translateImportError(message));
  }
}

function translateImportError(message: string): string {
  if (message === 'NO_CAPTIONS') {
    return 'Este video no tiene subtítulos disponibles. Prueba con otro video o sube el archivo manualmente.';
  }
  if (message === 'EMPTY_TRANSCRIPT') {
    return 'No se pudo extraer contenido de los subtítulos de ese video.';
  }
  if (message.startsWith('YOUTUBE_PAGE_FETCH_ERROR') || message.startsWith('YOUTUBE_TRANSCRIPT_FETCH_ERROR')) {
    return 'No se pudo acceder a ese video de YouTube. Verifica que sea público e inténtalo de nuevo.';
  }
  return 'No se pudo importar el video. Inténtalo de nuevo.';
}
