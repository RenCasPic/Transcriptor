import { describe, expect, it, vi } from 'vitest';
import { runTranscriptionJob, type TranscriptionJobDeps } from '@/lib/generation/transcription-pipeline';
import type { TranscriptionProvider, TranscriptResult } from '@/lib/ai/provider';
import type { AudioChunker } from '@/lib/media/audio-chunker';
import type { MediaLimits } from '@/lib/media/limits';

const MB = 1024 * 1024;

const LIMITS: MediaLimits = {
  maxUploadBytes: 500 * MB,
  maxDurationSeconds: 6 * 60 * 60,
  chunkTargetBytes: 20 * MB,
  chunkMaxSeconds: 600,
  chunkAudioBitrateKbps: 64,
};

function fakeProvider(supportsChunking = true): TranscriptionProvider {
  let call = 0;
  return {
    limits: { maxRequestBytes: 25 * MB, maxRequestSeconds: null, supportsChunking },
    async transcribe(input): Promise<TranscriptResult> {
      call += 1;
      if (input.demo) {
        return {
          fullText: 'demo',
          segments: [{ index: 0, speaker: null, startSeconds: 0, endSeconds: 1, text: 'demo', confidence: null }],
        };
      }
      const n = call;
      return {
        fullText: `part-${n}`,
        segments: [{ index: 0, speaker: null, startSeconds: 0, endSeconds: 2, text: `chunk-${n}`, confidence: null }],
      };
    },
  };
}

function fakeChunker(chunkCount: number): AudioChunker {
  return {
    async chunk() {
      return {
        totalDurationSeconds: chunkCount * 600,
        chunks: Array.from({ length: chunkCount }, (_, index) => ({
          index,
          startSeconds: index * 600,
          endSeconds: (index + 1) * 600,
          blob: new Blob([new Uint8Array(10)]),
          fileExtension: 'mp3',
          mimeType: 'audio/mpeg',
        })),
      };
    },
  };
}

function makeSupabase(opts: { job: unknown; mediaSource: unknown; objectSize: number }) {
  const updates: Record<string, unknown[]> = { generation_jobs: [], projects: [], media_sources: [] };

  const builder = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        if (table === 'generation_jobs') return { data: opts.job };
        if (table === 'media_sources') return { data: opts.mediaSource };
        return { data: null };
      },
      update: (payload: unknown) => {
        updates[table]?.push(payload);
        return { eq: async () => ({ data: null, error: null }) };
      },
    };
    return chain;
  };

  const supabase = {
    from: (table: string) => builder(table),
    storage: {
      from: () => ({
        list: async () => ({
          data: [{ name: 'file.mp4', metadata: { size: opts.objectSize } }],
        }),
        createSignedUrl: async () => ({ data: { signedUrl: 'https://signed.example/audio.mp4' }, error: null }),
      }),
    },
  };

  return { supabase: supabase as never, updates };
}

function webStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

function baseDeps(over: Partial<TranscriptionJobDeps>): { deps: Partial<TranscriptionJobDeps>; persist: ReturnType<typeof vi.fn>; runGeneration: ReturnType<typeof vi.fn> } {
  const persist = vi.fn(async () => ({ transcriptId: 'tr-1' }));
  const runGeneration = vi.fn(async () => ({ documentId: 'doc-1' }));
  return {
    persist,
    runGeneration,
    deps: {
      getLimits: () => LIMITS,
      isChunkingAvailable: async () => true,
      fetchImpl: (async () => ({ ok: true, body: webStream() })) as unknown as typeof fetch,
      persistTranscript: persist as unknown as TranscriptionJobDeps['persistTranscript'],
      runGeneration: runGeneration as unknown as TranscriptionJobDeps['runGeneration'],
      ...over,
    },
  };
}

const MEDIA_SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const JOB = {
  id: 'job-1',
  project_id: 'proj-1',
  status: 'queued',
  input: { mediaSourceId: MEDIA_SOURCE_ID, language: 'es', autoGenerate: true },
};
const UPLOAD_SOURCE = {
  id: MEDIA_SOURCE_ID,
  project_id: 'proj-1',
  storage_path: 'ws-1/proj-1/file.mp4',
  source_url: null,
  original_filename: 'file.mp4',
};

describe('runTranscriptionJob', () => {
  it('archivo pequeño: transcribe en una sola pasada y encadena la generación', async () => {
    const { supabase, updates } = makeSupabase({ job: JOB, mediaSource: UPLOAD_SOURCE, objectSize: 5 * MB });
    const { deps, persist, runGeneration } = baseDeps({ getProvider: () => fakeProvider(true) });

    const result = await runTranscriptionJob(supabase, { jobId: 'job-1', deps });

    expect(result.status).toBe('completed');
    expect(persist).toHaveBeenCalledOnce();
    const savedSegments = (persist.mock.calls[0]![1] as { segments: unknown[] }).segments;
    expect(savedSegments).toHaveLength(1);
    expect(runGeneration).toHaveBeenCalledOnce();
    const completed = (updates.generation_jobs as Array<{ status?: string; output?: { transcribedVia?: string } }>).find(
      (u) => u.status === 'completed',
    );
    expect(completed?.output?.transcribedVia).toBe('single');
  });

  it('archivo grande: trocea, transcribe cada parte y recompone una transcripción ordenada con timestamps', async () => {
    const { supabase, updates } = makeSupabase({ job: JOB, mediaSource: UPLOAD_SOURCE, objectSize: 120 * MB });
    const { deps, persist } = baseDeps({
      getProvider: () => fakeProvider(true),
      getChunker: () => fakeChunker(3),
    });

    const result = await runTranscriptionJob(supabase, { jobId: 'job-1', deps });

    expect(result.status).toBe('completed');
    const saved = persist.mock.calls[0]![1] as { segments: Array<{ index: number; startSeconds: number; text: string }> };
    expect(saved.segments.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(saved.segments.map((s) => s.startSeconds)).toEqual([0, 600, 1200]);
    expect(saved.segments.map((s) => s.text)).toEqual(['chunk-1', 'chunk-2', 'chunk-3']);
    const completed = (updates.generation_jobs as Array<{ status?: string; output?: { chunkCount?: number } }>).find(
      (u) => u.status === 'completed',
    );
    expect(completed?.output?.chunkCount).toBe(3);
  });

  it('archivo grande sin troceador disponible: falla con un código explícito y recuperable', async () => {
    const { supabase, updates } = makeSupabase({ job: JOB, mediaSource: UPLOAD_SOURCE, objectSize: 120 * MB });
    const { deps } = baseDeps({
      getProvider: () => fakeProvider(true),
      isChunkingAvailable: async () => false,
    });

    const result = await runTranscriptionJob(supabase, { jobId: 'job-1', deps });

    expect(result).toMatchObject({ status: 'failed', errorCode: 'MEDIA_REQUIRES_CHUNKING_UNAVAILABLE' });
    expect((updates.projects as Array<{ status?: string }>).some((u) => u.status === 'failed')).toBe(true);
  });

  it('modo demo: no accede al archivo ni trocea, y marca transcribedVia=demo', async () => {
    const { supabase, updates } = makeSupabase({ job: JOB, mediaSource: UPLOAD_SOURCE, objectSize: 999 * MB });
    const { deps, persist } = baseDeps({ getProvider: () => fakeProvider(false) });

    const result = await runTranscriptionJob(supabase, { jobId: 'job-1', deps });

    expect(result.status).toBe('completed');
    expect(persist).toHaveBeenCalledOnce();
    const completed = (updates.generation_jobs as Array<{ status?: string; output?: { transcribedVia?: string } }>).find(
      (u) => u.status === 'completed',
    );
    expect(completed?.output?.transcribedVia).toBe('demo');
  });

  it('autoGenerate=false: guarda la transcripción y deja el proyecto en draft sin generar', async () => {
    const job = { ...JOB, input: { ...JOB.input, autoGenerate: false } };
    const { supabase, updates } = makeSupabase({ job, mediaSource: UPLOAD_SOURCE, objectSize: 5 * MB });
    const { deps, runGeneration } = baseDeps({ getProvider: () => fakeProvider(true) });

    await runTranscriptionJob(supabase, { jobId: 'job-1', deps });

    expect(runGeneration).not.toHaveBeenCalled();
    expect((updates.projects as Array<{ status?: string }>).some((u) => u.status === 'draft')).toBe(true);
  });

  it('job ya completado: no hace nada (idempotente)', async () => {
    const job = { ...JOB, status: 'completed' };
    const { supabase } = makeSupabase({ job, mediaSource: UPLOAD_SOURCE, objectSize: 5 * MB });
    const { deps, persist } = baseDeps({ getProvider: () => fakeProvider(true) });

    const result = await runTranscriptionJob(supabase, { jobId: 'job-1', deps });

    expect(result.status).toBe('skipped');
    expect(persist).not.toHaveBeenCalled();
  });
});
