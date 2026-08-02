'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { getTranscriptionProvider } from '@/lib/ai/transcription';
import { saveTranscript } from '@/lib/generation/save-transcript';
import { checkRateLimit } from '@/lib/rate-limit';

const SIGNED_URL_TTL_SECONDS = 300;
const TRANSCRIPTION_RATE_LIMIT = 5;
const TRANSCRIPTION_RATE_WINDOW_SECONDS = 60 * 60;

const TranscribeMediaSchema = z.object({
  projectId: z.string().uuid(),
  sourceType: z.enum(['audio', 'video']),
  storagePath: z.string().min(1),
  originalFilename: z.string().min(1),
  language: z.string().min(2).max(10).default('es'),
});

export type TranscribeMediaInput = z.infer<typeof TranscribeMediaSchema>;

/**
 * Transcribe un archivo de audio/video ya subido a Storage usando el
 * proveedor de transcripción configurado (Whisper en producción, demo si no
 * hay clave). Crea el media_source, la transcripción y sus segmentos, y deja
 * el proyecto listo para generar el artículo.
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

  const rateLimit = checkRateLimit(
    `transcribe-media:${user.id}`,
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
    .eq('id', parsed.data.projectId)
    .maybeSingle();
  if (!project) {
    return err('NOT_FOUND', 'Proyecto no encontrado.');
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: parsed.data.projectId,
      source_type: parsed.data.sourceType,
      original_filename: parsed.data.originalFilename,
      storage_path: parsed.data.storagePath,
    })
    .select('id')
    .single();

  if (sourceError || !source) {
    return err('CREATE_SOURCE_ERROR', 'No se pudo registrar el archivo.');
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
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('project-sources')
      .createSignedUrl(parsed.data.storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedUrlError || !signedUrlData) {
      throw new Error('SIGNED_URL_ERROR');
    }

    const provider = getTranscriptionProvider();
    const result = await provider.transcribe({
      mediaUrl: signedUrlData.signedUrl,
      language: parsed.data.language,
    });

    const saved = await saveTranscript(supabase, {
      projectId: parsed.data.projectId,
      sourceId: source.id,
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
    const message = error instanceof Error ? error.message : 'TRANSCRIPTION_FAILED';

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    await supabase.from('projects').update({ status: 'failed' }).eq('id', parsed.data.projectId);

    return err('TRANSCRIPTION_FAILED', translateTranscriptionError(message));
  }
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
