'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { checkRateLimit } from '@/lib/rate-limit';
import { saveTranscript } from '@/lib/generation/save-transcript';
import { extractYoutubeVideoId, fetchYoutubeTranscript, isValidYoutubeVideoId } from '@/lib/integrations/youtube-transcript';
import { getAudioExtractor } from '@/lib/integrations/audio-extractor';
import { getTranscriptionProvider, isRealTranscriptionConfigured } from '@/lib/ai/transcription';
import { readStreamWithLimit } from '@/lib/media/read-stream-with-limit';
import { MAX_MEDIA_BYTES } from '@/lib/media/limits';
import { translateImportError, translateAudioFallbackError, extractYoutubeErrorCode } from './youtube-errors';

const IMPORT_RATE_LIMIT = 5;
const IMPORT_RATE_WINDOW_SECONDS = 60 * 60;

// El fallback de audio es más caro (descarga + transcripción real vía Groq),
// así que se limita aparte y más estricto que el chequeo de subtítulos.
const AUDIO_FALLBACK_RATE_LIMIT = 3;
const AUDIO_FALLBACK_RATE_WINDOW_SECONDS = 60 * 60;

// Tope de duración para el fallback de audio, no para el video en sí:
// evita gastar tiempo/memoria descargando audio de contenido excesivamente
// largo (streams, películas completas, etc.). Configurable por si algún
// despliegue necesita un límite distinto.
const MAX_YOUTUBE_AUDIO_DURATION_SECONDS = Number(process.env.YOUTUBE_AUDIO_MAX_DURATION_SECONDS ?? 5400);
const AUDIO_DOWNLOAD_TIMEOUT_MS = 60_000;

const ImportYoutubeVideoSchema = z.object({
  projectId: z.string().uuid(),
  videoUrl: z.string().url('Ingresa una URL válida'),
  language: z.string().min(2).max(10).default('es'),
});

export type ImportYoutubeVideoInput = z.infer<typeof ImportYoutubeVideoSchema>;

export type ImportYoutubeVideoResult =
  | { status: 'completed'; transcriptId: string; title: string }
  | { status: 'needs_audio_fallback'; sourceId: string; jobId: string | null; videoId: string; title: string };

/**
 * Importa un video de YouTube a partir de su URL. Primero intenta usar sus
 * subtítulos (propios o ajenos, siempre que el video sea público) vía
 * `fetchYoutubeTranscript`. Si el video no tiene subtítulos y hay un
 * proveedor de transcripción real configurado, en vez de fallar devuelve
 * `needs_audio_fallback` para que el cliente encadene
 * `transcribeYoutubeAudioAction` (ver ese módulo para el porqué de dos
 * llamadas en vez de una sola función que hace todo).
 */
export async function importYoutubeVideoAction(
  input: ImportYoutubeVideoInput,
): Promise<ActionResult<ImportYoutubeVideoResult>> {
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
    return ok({ status: 'completed', transcriptId: saved.transcriptId, title: transcript.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'YOUTUBE_IMPORT_FAILED';

    // Cualquier fallo que signifique "no hay subtítulos utilizables" (no
    // existen, quedaron vacíos, o la pista no se pudo parsear) dispara el
    // fallback de audio. YOUTUBE_PAGE_FETCH_ERROR/YOUTUBE_TRANSCRIPT_FETCH_ERROR
    // quedan afuera a propósito: si ni siquiera se pudo acceder al video,
    // el fallback de audio (que también necesita acceder a él) fallaría
    // igual, sin más info, solo gastando el límite de uso de Groq.
    const hasNoUsableCaptions =
      message === 'NO_CAPTIONS' || message === 'EMPTY_TRANSCRIPT' || message === 'TRANSCRIPT_FETCH_PARSE_ERROR';

    if (hasNoUsableCaptions && isRealTranscriptionConfigured()) {
      // No se marca el job/proyecto como fallido: sigue "processing" hasta
      // que el cliente encadene transcribeYoutubeAudioAction con este mismo
      // source/job. Si el usuario abandona sin reintentar, queda como
      // "processing" — mismo comportamiento que cualquier otro job huérfano
      // de este MVP (no hay barrido de jobs colgados).
      return ok({
        status: 'needs_audio_fallback',
        sourceId: source.id,
        jobId: job?.id ?? null,
        videoId,
        title: 'Video de YouTube',
      });
    }

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

const TranscribeYoutubeAudioSchema = z.object({
  projectId: z.string().uuid(),
  sourceId: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
  videoId: z.string().refine(isValidYoutubeVideoId, 'ID de video inválido'),
  language: z.string().min(2).max(10).default('es'),
});

export type TranscribeYoutubeAudioInput = z.infer<typeof TranscribeYoutubeAudioSchema>;

/**
 * Segunda fase del import de YouTube, usada cuando el video no tiene
 * subtítulos: extrae su audio (`AudioExtractor`, hoy vía @distube/ytdl-core) y lo
 * transcribe con el proveedor de transcripción configurado (Groq/Whisper).
 *
 * Es una Server Action separada (no parte de `importYoutubeVideoAction`) a
 * propósito, para que el cliente pueda mostrar progreso real en dos pasos
 * ("buscando subtítulos" -> "transcribiendo audio") en vez de una sola
 * espera opaca. El audio nunca se sube a Storage ni se guarda en ningún
 * lado: se descarga a memoria, se manda a la API de transcripción y se
 * descarta al terminar la función (ver `readStreamWithLimit`).
 */
export async function transcribeYoutubeAudioAction(
  input: TranscribeYoutubeAudioInput,
): Promise<ActionResult<{ transcriptId: string; title: string }>> {
  const parsed = TranscribeYoutubeAudioSchema.safeParse(input);
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

  if (!isRealTranscriptionConfigured()) {
    return err(
      'NO_REAL_TRANSCRIPTION_PROVIDER',
      'No hay un proveedor de transcripción configurado para procesar audio sin subtítulos.',
    );
  }

  const rateLimit = checkRateLimit(
    `transcribe-youtube-audio:${user.id}`,
    AUDIO_FALLBACK_RATE_LIMIT,
    AUDIO_FALLBACK_RATE_WINDOW_SECONDS,
  );
  if (!rateLimit.allowed) {
    return err(
      'RATE_LIMITED',
      `Alcanzaste el límite de transcripciones automáticas de YouTube. Inténtalo de nuevo en ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minutos.`,
    );
  }

  // RLS ya filtra por membresía; este select además confirma que el source
  // realmente pertenece al proyecto indicado (evita usar el jobId/sourceId
  // de otro proyecto aunque ambos sean del mismo usuario).
  const { data: source } = await supabase
    .from('media_sources')
    .select('id')
    .eq('id', parsed.data.sourceId)
    .eq('project_id', parsed.data.projectId)
    .maybeSingle();
  if (!source) {
    return err('NOT_FOUND', 'No se encontró el video original.');
  }

  try {
    const extractor = getAudioExtractor();
    const extracted = await extractor.extract(`https://www.youtube.com/watch?v=${parsed.data.videoId}`, {
      maxDurationSeconds: MAX_YOUTUBE_AUDIO_DURATION_SECONDS,
    });

    const audioBuffer = await readStreamWithLimit(extracted.stream, MAX_MEDIA_BYTES, AUDIO_DOWNLOAD_TIMEOUT_MS);
    // Buffer es un Uint8Array válido en runtime; el cast solo evita un
    // desajuste entre los tipos de Node (ArrayBufferLike) y DOM (ArrayBuffer)
    // para BlobPart, sin copiar el buffer.
    const audioBlob = new Blob([audioBuffer as unknown as BlobPart], { type: extracted.mimeType });

    const provider = getTranscriptionProvider();
    const result = await provider.transcribe({
      audioBlob,
      fileExtension: extracted.fileExtension,
      language: parsed.data.language,
    });

    const saved = await saveTranscript(supabase, {
      projectId: parsed.data.projectId,
      sourceId: parsed.data.sourceId,
      language: parsed.data.language,
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

    await supabase
      .from('media_sources')
      .update({ metadata: { videoId: parsed.data.videoId, title: extracted.title, transcribedFrom: 'audio_fallback' } })
      .eq('id', parsed.data.sourceId);

    if (parsed.data.jobId) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() })
        .eq('id', parsed.data.jobId);
    }
    await supabase.from('projects').update({ status: 'draft' }).eq('id', parsed.data.projectId);

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok({ transcriptId: saved.transcriptId, title: extracted.title });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'YOUTUBE_AUDIO_TRANSCRIPTION_FAILED';

    if (parsed.data.jobId) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', parsed.data.jobId);
    }
    await supabase.from('projects').update({ status: 'failed' }).eq('id', parsed.data.projectId);

    // El código específico (p. ej. YOUTUBE_EXTRACTOR_INCOMPATIBLE,
    // YOUTUBE_PRIVATE_VIDEO) se expone tal cual como `error.code`, en vez de
    // envolverlo todo bajo un único código genérico: así el frontend puede
    // decidir qué sugerir (tips de ImportErrorPanel) sin tener que parsear
    // el mensaje en español.
    return err(
      extractYoutubeErrorCode(message),
      translateAudioFallbackError(message, MAX_YOUTUBE_AUDIO_DURATION_SECONDS),
    );
  }
}
