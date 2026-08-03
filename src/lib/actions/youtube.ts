'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeTranscript } from '@/lib/content/normalize';
import { saveTranscript } from '@/lib/generation/save-transcript';
import { getValidYoutubeAccessToken } from '@/lib/integrations/youtube-tokens';
import {
  downloadCaptionTrack,
  fetchCaptionTracks,
  fetchChannelVideos,
  selectCaptionTrack,
  type YoutubeVideo,
} from '@/lib/integrations/youtube-client';

const IMPORT_RATE_LIMIT = 5;
const IMPORT_RATE_WINDOW_SECONDS = 60 * 60;

interface YoutubeIntegrationMetadata {
  uploadsPlaylistId?: string;
}

const ListYoutubeVideosSchema = z.object({
  workspaceId: z.string().uuid(),
  pageToken: z.string().optional(),
});

export type ListYoutubeVideosInput = z.infer<typeof ListYoutubeVideosSchema>;

/** Lista los videos subidos al canal de YouTube conectado del workspace. */
export async function listYoutubeVideosAction(
  input: ListYoutubeVideosInput,
): Promise<ActionResult<{ videos: YoutubeVideo[]; nextPageToken: string | null }>> {
  const parsed = ListYoutubeVideosSchema.safeParse(input);
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

  const { data: integration } = await supabase
    .from('integrations')
    .select('status, metadata')
    .eq('workspace_id', parsed.data.workspaceId)
    .eq('provider', 'youtube')
    .maybeSingle();

  if (!integration || integration.status !== 'connected') {
    return err('YOUTUBE_NOT_CONNECTED', 'Conecta tu canal de YouTube en Configuración → Integraciones.');
  }

  const uploadsPlaylistId = (integration.metadata as YoutubeIntegrationMetadata).uploadsPlaylistId;
  if (!uploadsPlaylistId) {
    return err('YOUTUBE_NOT_CONNECTED', 'Conecta tu canal de YouTube en Configuración → Integraciones.');
  }

  try {
    const accessToken = await getValidYoutubeAccessToken(supabase, parsed.data.workspaceId);
    if (!accessToken) {
      return err('YOUTUBE_NOT_CONNECTED', 'Conecta tu canal de YouTube en Configuración → Integraciones.');
    }

    const page = await fetchChannelVideos(accessToken, uploadsPlaylistId, parsed.data.pageToken);
    return ok(page);
  } catch {
    return err('YOUTUBE_API_ERROR', 'No se pudo obtener la lista de videos de YouTube.');
  }
}

const ImportYoutubeCaptionsSchema = z.object({
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  videoId: z.string().min(1),
  videoTitle: z.string().min(1),
  language: z.string().min(2).max(10).default('es'),
});

export type ImportYoutubeCaptionsInput = z.infer<typeof ImportYoutubeCaptionsSchema>;

/**
 * Importa los subtítulos ya existentes de un video del canal propio (vía
 * `captions.download` de la Data API v3) como transcripción del proyecto.
 * No descarga ni transcribe el audio/video real: si el video no tiene
 * subtítulos, se le pide al usuario que lo suba manualmente.
 */
export async function importYoutubeCaptionsAction(
  input: ImportYoutubeCaptionsInput,
): Promise<ActionResult<{ transcriptId: string }>> {
  const parsed = ImportYoutubeCaptionsSchema.safeParse(input);
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

  const accessToken = await getValidYoutubeAccessToken(supabase, parsed.data.workspaceId);
  if (!accessToken) {
    return err('YOUTUBE_NOT_CONNECTED', 'Conecta tu canal de YouTube en Configuración → Integraciones.');
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: parsed.data.projectId,
      source_type: 'youtube',
      original_filename: null,
      source_url: `https://www.youtube.com/watch?v=${parsed.data.videoId}`,
      metadata: { videoId: parsed.data.videoId, title: parsed.data.videoTitle },
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
    const tracks = await fetchCaptionTracks(accessToken, parsed.data.videoId);
    const track = selectCaptionTrack(tracks, parsed.data.language);
    if (!track) {
      throw new Error('NO_CAPTIONS');
    }

    const srtText = await downloadCaptionTrack(accessToken, track.captionId);
    const normalized = normalizeTranscript(srtText, 'srt');

    if (normalized.segments.length === 0) {
      throw new Error('EMPTY_TRANSCRIPT');
    }

    const saved = await saveTranscript(supabase, {
      projectId: parsed.data.projectId,
      sourceId: source.id,
      language: parsed.data.language,
      fullText: normalized.fullText,
      segments: normalized.segments,
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
    await supabase.from('projects').update({ status: 'draft' }).eq('id', parsed.data.projectId);

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok({ transcriptId: saved.transcriptId });
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
    return 'Este video no tiene subtítulos disponibles. Súbelo manualmente en la pestaña "Video o audio" u otro video.';
  }
  if (message === 'EMPTY_TRANSCRIPT') {
    return 'No se pudo extraer contenido de los subtítulos de ese video.';
  }
  if (message.startsWith('YOUTUBE_API_ERROR')) {
    return 'No se pudo acceder a YouTube. Inténtalo de nuevo.';
  }
  return 'No se pudo importar el video. Inténtalo de nuevo.';
}
