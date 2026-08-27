import { Readable } from 'node:stream';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/lib/types/database';
import type { TranscriptionProvider, TranscriptResult } from '@/lib/ai/provider';
import { getTranscriptionProvider } from '@/lib/ai/transcription';
import { getAudioChunker, isAudioChunkingAvailable, type AudioChunker } from '@/lib/media/audio-chunker';
import { mergeChunkTranscripts, type ChunkTranscript } from '@/lib/media/merge-transcripts';
import { getMediaLimits, type MediaLimits } from '@/lib/media/limits';
import { extensionOf } from '@/lib/media/formats';
import { saveTranscript } from '@/lib/generation/save-transcript';
import { runArticleGenerationPipeline } from '@/lib/generation/pipeline';
import { isUrlSafeToFetch } from '@/lib/security/url-safety';

const SIGNED_URL_TTL_SECONDS = 60 * 30;
const STORAGE_BUCKET = 'project-sources';

/** Etapas del job, expuestas en `generation_jobs.output.stage` para la UI. */
export type TranscriptionStage =
  | 'preparing'
  | 'downloading'
  | 'chunking'
  | 'transcribing'
  | 'generating'
  | 'completed'
  | 'error';

export interface TranscriptionJobResult {
  status: 'completed' | 'failed' | 'skipped';
  jobId: string;
  errorCode?: string;
}

const JobInputSchema = z.object({
  mediaSourceId: z.string().uuid(),
  language: z.string().min(2).max(10).default('es'),
  autoGenerate: z.boolean().default(true),
});

interface JobOutput {
  stage: TranscriptionStage;
  progress: number;
  errorCode?: string;
  transcriptId?: string;
  documentId?: string;
  chunkCount?: number;
  transcribedVia?: 'single' | 'chunked';
}

/**
 * Procesador de un job de transcripción. Es lógica de negocio pura, aislada
 * del transporte (mismo principio que `runArticleGenerationPipeline`):
 * recibe un cliente Supabase inyectado y no sabe si lo invoca una Server
 * Action vía `after()`, un Route Handler llamado por un cron, o un worker
 * dedicado en el futuro. El pipeline de generación de artículos que encadena
 * al final NO sabe nada de subida, troceado ni proveedores: recibe una
 * transcripción ya guardada como cualquier otra.
 *
 * Flujo:  media en Storage/URL  →  (audio)  →  chunks si excede el límite del
 * proveedor  →  proveedor de transcripción  →  transcripción normalizada  →
 * (opcional) pipeline de generación.
 */
export async function runTranscriptionJob(
  supabase: SupabaseClient<Database>,
  params: { jobId: string; deps?: Partial<TranscriptionJobDeps> },
): Promise<TranscriptionJobResult> {
  const deps: TranscriptionJobDeps = {
    getProvider: getTranscriptionProvider,
    getChunker: getAudioChunker,
    isChunkingAvailable: isAudioChunkingAvailable,
    getLimits: getMediaLimits,
    fetchImpl: fetch,
    runGeneration: runArticleGenerationPipeline,
    persistTranscript: saveTranscript,
    ...params.deps,
  };

  const { jobId } = params;

  const { data: job } = await supabase
    .from('generation_jobs')
    .select('id, project_id, status, input')
    .eq('id', jobId)
    .maybeSingle();

  if (!job) return { status: 'skipped', jobId };
  if (job.status === 'completed') return { status: 'skipped', jobId };

  const parsedInput = JobInputSchema.safeParse(job.input);
  if (!parsedInput.success) {
    await failJob(supabase, jobId, job.project_id, 'INVALID_JOB_INPUT');
    return { status: 'failed', jobId, errorCode: 'INVALID_JOB_INPUT' };
  }
  const input = parsedInput.data;

  await setJobProgress(supabase, jobId, { stage: 'preparing', progress: 5 });
  await supabase
    .from('generation_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', jobId);
  await supabase.from('projects').update({ status: 'processing' }).eq('id', job.project_id);

  try {
    const { data: source } = await supabase
      .from('media_sources')
      .select('id, project_id, storage_path, source_url, original_filename')
      .eq('id', input.mediaSourceId)
      .maybeSingle();

    if (!source || source.project_id !== job.project_id) {
      throw new JobError('MEDIA_SOURCE_NOT_FOUND');
    }

    const limits = deps.getLimits();
    const provider = deps.getProvider();

    let transcript: TranscriptResult;
    let transcribedVia: JobOutput['transcribedVia'];
    let chunkCount = 1;
    let durationSeconds: number | null = null;

    const media = await resolveMediaAccess(supabase, source, limits, deps);
    const fileExtension =
      extensionOf(source.original_filename ?? '') ||
      (media.kind === 'url' ? extensionOf(new URL(media.url).pathname) : 'mp4');

    if (media.sizeBytes !== null && media.sizeBytes <= provider.limits.maxRequestBytes) {
      await setJobProgress(supabase, jobId, { stage: 'transcribing', progress: 40 });
      const single = await provider.transcribe({
        mediaUrl: media.url,
        fileExtension,
        language: input.language,
      });
      transcript = mergeChunkTranscripts([{ startSeconds: 0, result: single }]);
      transcribedVia = 'single';
    } else {
      if (!(await deps.isChunkingAvailable())) {
        throw new JobError('MEDIA_REQUIRES_CHUNKING_UNAVAILABLE');
      }
      await setJobProgress(supabase, jobId, { stage: 'chunking', progress: 20 });

      const stream = await openStream(media.url, deps.fetchImpl);
      const chunker: AudioChunker = deps.getChunker();
      const { chunks, totalDurationSeconds } = await chunker.chunk(
        { stream, sourceExtension: fileExtension },
        {
          targetBytes: Math.min(limits.chunkTargetBytes, provider.limits.maxRequestBytes),
          maxSeconds: limits.chunkMaxSeconds,
          audioBitrateKbps: limits.chunkAudioBitrateKbps,
          maxTotalSeconds: limits.maxDurationSeconds,
        },
      );

      durationSeconds = totalDurationSeconds || null;
      chunkCount = chunks.length;
      const parts: ChunkTranscript[] = [];
      for (const chunk of chunks) {
        await setJobProgress(supabase, jobId, {
          stage: 'transcribing',
          progress: 25 + Math.round((chunk.index / chunks.length) * 55),
        });
        const partial = await transcribeChunk(provider, chunk.blob, chunk.fileExtension, input.language);
        parts.push({ startSeconds: chunk.startSeconds, result: partial });
      }
      transcript = mergeChunkTranscripts(parts);
      transcribedVia = 'chunked';
    }

    if (transcript.segments.length === 0) {
      throw new JobError('EMPTY_TRANSCRIPT');
    }

    await setJobProgress(supabase, jobId, { stage: 'transcribing', progress: 82 });

    const title = source.original_filename ?? 'Audio subido';

    const saved = await deps.persistTranscript(supabase, {
      projectId: job.project_id,
      sourceId: source.id,
      language: input.language,
      fullText: transcript.fullText,
      segments: transcript.segments.map((s) => ({
        index: s.index,
        speaker: s.speaker,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        text: s.text,
      })),
    });
    if ('error' in saved) {
      throw new JobError(saved.error);
    }

    await supabase
      .from('media_sources')
      .update({
        duration_seconds: durationSeconds,
        metadata: { title, transcribedVia, chunkCount },
      })
      .eq('id', source.id);

    let documentId: string | undefined;
    if (input.autoGenerate) {
      await setJobProgress(supabase, jobId, { stage: 'generating', progress: 88 });
      const generated = await deps.runGeneration(supabase, {
        projectId: job.project_id,
        actorId: null,
      });
      documentId = generated.documentId;
    } else {
      await supabase.from('projects').update({ status: 'draft' }).eq('id', job.project_id);
    }

    await supabase
      .from('generation_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        output: {
          stage: 'completed',
          progress: 100,
          transcriptId: saved.transcriptId,
          documentId,
          chunkCount,
          transcribedVia,
        } satisfies JobOutput,
      })
      .eq('id', jobId);

    return { status: 'completed', jobId };
  } catch (error) {
    const errorCode = error instanceof JobError ? error.code : normalizeErrorCode(error);
    await failJob(supabase, jobId, job.project_id, errorCode);
    return { status: 'failed', jobId, errorCode };
  }
}

export interface TranscriptionJobDeps {
  getProvider: () => TranscriptionProvider;
  getChunker: () => AudioChunker;
  isChunkingAvailable: () => Promise<boolean>;
  getLimits: () => MediaLimits;
  fetchImpl: typeof fetch;
  runGeneration: typeof runArticleGenerationPipeline;
  persistTranscript: typeof saveTranscript;
}

class JobError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function normalizeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'TRANSCRIPTION_NOT_CONFIGURED') return 'TRANSCRIPTION_NOT_CONFIGURED';
  if (message === 'AI_NOT_CONFIGURED') return 'AI_NOT_CONFIGURED';
  if (message.startsWith('AUDIO_CHUNKER_UNAVAILABLE')) return 'MEDIA_REQUIRES_CHUNKING_UNAVAILABLE';
  if (message.startsWith('MEDIA_DURATION_EXCEEDED')) return 'MEDIA_DURATION_EXCEEDED';
  if (message.startsWith('FFMPEG_EXIT')) return 'AUDIO_EXTRACTION_FAILED';
  if (message.startsWith('AUDIO_CHUNKING_PRODUCED_NO_OUTPUT')) return 'AUDIO_EXTRACTION_FAILED';
  if (message.startsWith('TRANSCRIPTION_PROVIDER_HTTP_ERROR')) return message.split(':').slice(0, 2).join(':');
  if (message === 'TRANSCRIPTION_FILE_TOO_LARGE') return 'CHUNK_TOO_LARGE';
  return message.slice(0, 120);
}

interface MediaAccess {
  kind: 'upload' | 'url';
  url: string;
  sizeBytes: number | null;
}

async function resolveMediaAccess(
  supabase: SupabaseClient<Database>,
  source: { storage_path: string | null; source_url: string | null; original_filename: string | null },
  limits: MediaLimits,
  deps: TranscriptionJobDeps,
): Promise<MediaAccess> {
  if (source.storage_path) {
    const dir = source.storage_path.split('/').slice(0, -1).join('/');
    const name = source.storage_path.split('/').pop() ?? '';
    const { data: listed } = await supabase.storage.from(STORAGE_BUCKET).list(dir, { search: name });
    const entry = listed?.find((item) => item.name === name);
    const sizeBytes = toNumber(entry?.metadata?.size);

    if (sizeBytes !== null && sizeBytes > limits.maxUploadBytes) {
      throw new JobError('MEDIA_FILE_TOO_LARGE');
    }

    const { data: signed, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(source.storage_path, SIGNED_URL_TTL_SECONDS);
    if (error || !signed) throw new JobError('MEDIA_ACCESS_FAILED');

    return { kind: 'upload', url: signed.signedUrl, sizeBytes };
  }

  if (source.source_url) {
    // Defensa en profundidad: la URL ya se validó al encolar, pero se
    // re-verifica antes de que el procesador la use (evita SSRF si la fila se
    // manipulara por otra vía).
    if (!isUrlSafeToFetch(source.source_url)) {
      throw new JobError('MEDIA_ACCESS_FAILED');
    }
    let head: Response;
    try {
      head = await deps.fetchImpl(source.source_url, { method: 'HEAD', redirect: 'follow' });
    } catch {
      throw new JobError('MEDIA_ACCESS_FAILED');
    }
    const sizeBytes = toNumber(head.headers.get('content-length'));
    if (sizeBytes !== null && sizeBytes > limits.maxUploadBytes) {
      throw new JobError('MEDIA_FILE_TOO_LARGE');
    }
    return { kind: 'url', url: source.source_url, sizeBytes };
  }

  throw new JobError('MEDIA_SOURCE_NOT_FOUND');
}

async function openStream(url: string, fetchImpl: typeof fetch): Promise<Readable> {
  const response = await fetchImpl(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new JobError('MEDIA_ACCESS_FAILED');
  }
  return Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
}

async function transcribeChunk(
  provider: TranscriptionProvider,
  blob: Blob,
  fileExtension: string,
  language: string,
): Promise<TranscriptResult> {
  return provider.transcribe({ audioBlob: blob, fileExtension, language });
}

async function setJobProgress(
  supabase: SupabaseClient<Database>,
  jobId: string,
  output: { stage: TranscriptionStage; progress: number },
): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({
      progress: output.progress,
      output: { stage: output.stage, progress: output.progress } satisfies JobOutput,
    })
    .eq('id', jobId);
}

async function failJob(
  supabase: SupabaseClient<Database>,
  jobId: string,
  projectId: string,
  errorCode: string,
): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({
      status: 'failed',
      error_message: errorCode,
      completed_at: new Date().toISOString(),
      output: { stage: 'error', progress: 100, errorCode } satisfies JobOutput,
    })
    .eq('id', jobId);
  await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
