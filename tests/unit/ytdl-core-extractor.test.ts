import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { YtdlCoreAudioExtractor } from '@/lib/integrations/audio-extractor/ytdl-core-extractor';
import type { ExtractionAttemptRecord, ExtractionLogger, ExtractionSummaryRecord } from '@/lib/integrations/audio-extractor/extraction-logger';

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function audioFormat(overrides: Partial<{ url: string; mimeType: string; audioBitrate: number }> = {}) {
  return {
    url: 'https://rr3---sn-cdn.googlevideo.com/videoplayback?itag=140',
    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
    audioBitrate: 128,
    ...overrides,
  };
}

function makeInfo(formats: unknown[], details: Record<string, unknown> = {}) {
  return {
    videoDetails: {
      isPrivate: false,
      isLiveContent: false,
      lengthSeconds: '212',
      title: 'Test video',
      ...details,
    },
    formats,
  };
}

function makeYtdl(getInfo: ReturnType<typeof vi.fn>) {
  return {
    version: '4.16.12',
    getInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterFormats: (formats: any[]) => formats.filter((f) => (f.mimeType ?? '').startsWith('audio/')),
    downloadFromInfo: vi.fn(() => Readable.from([Buffer.from('audio-bytes')])),
  };
}

function recordingLogger() {
  const attempts: ExtractionAttemptRecord[] = [];
  const summaries: ExtractionSummaryRecord[] = [];
  const logger: ExtractionLogger = {
    attempt: (r) => attempts.push(r),
    summary: (r) => summaries.push(r),
  };
  return { logger, attempts, summaries };
}

const okProbe = vi.fn(async () => ({ status: 206, body: { cancel: async () => {} } }) as unknown as Response);
const forbiddenProbe = vi.fn(async () => ({ status: 403, body: null }) as unknown as Response);

describe('YtdlCoreAudioExtractor — estrategia de reintentos', () => {
  it('devuelve el audio en el primer intento cuando todo va bien', async () => {
    const getInfo = vi.fn(async () => makeInfo([audioFormat()]));
    const { logger, attempts, summaries } = recordingLogger();

    const result = await new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
      deps: { ytdl: makeYtdl(getInfo), fetch: okProbe as unknown as typeof fetch, logger },
    });

    expect(result.fileExtension).toBe('m4a');
    expect(result.mimeType).toBe('audio/mp4');
    expect(result.durationSeconds).toBe(212);
    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      outcome: 'success',
      attempt: 1,
      strategy: 'default-audio',
      extractorVersion: '4.16.12',
    });
    expect(summaries[0]).toMatchObject({ outcome: 'success', winningStrategy: 'default-audio' });
  });

  it('reintenta con el siguiente player_client si el primero no resuelve ninguna URL de audio', async () => {
    const getInfo = vi
      .fn()
      .mockResolvedValueOnce(makeInfo([audioFormat({ url: undefined })]))
      .mockResolvedValueOnce(makeInfo([audioFormat()]));
    const { logger, attempts } = recordingLogger();

    const result = await new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
      deps: { ytdl: makeYtdl(getInfo), fetch: okProbe as unknown as typeof fetch, logger },
    });

    expect(result.fileExtension).toBe('m4a');
    expect(getInfo).toHaveBeenCalledTimes(2);
    expect(attempts.map((a) => a.outcome)).toEqual(['failure', 'success']);
    expect(attempts[0]?.errorCode).toBe('YOUTUBE_EXTRACTOR_INCOMPATIBLE');
  });

  it('agota los 3 intentos y lanza YOUTUBE_EXTRACTOR_BLOCKED cuando el CDN responde 403', async () => {
    const getInfo = vi.fn(async () => makeInfo([audioFormat()]));
    const { logger, attempts, summaries } = recordingLogger();

    await expect(
      new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
        deps: { ytdl: makeYtdl(getInfo), fetch: forbiddenProbe as unknown as typeof fetch, logger },
      }),
    ).rejects.toThrow('YOUTUBE_EXTRACTOR_BLOCKED');

    expect(getInfo).toHaveBeenCalledTimes(3);
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.outcome === 'failure' && a.errorCode === 'YOUTUBE_EXTRACTOR_BLOCKED')).toBe(true);
    expect(summaries.at(-1)).toMatchObject({ outcome: 'failure', errorCode: 'YOUTUBE_EXTRACTOR_BLOCKED', attempts: 3 });
  });

  it('lanza YOUTUBE_EXTRACTOR_INCOMPATIBLE cuando ningún intento logra descifrar el reproductor', async () => {
    const getInfo = vi.fn(async () => {
      throw new Error('Could not parse n transform function');
    });
    const { logger } = recordingLogger();

    await expect(
      new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
        deps: { ytdl: makeYtdl(getInfo), fetch: okProbe as unknown as typeof fetch, logger },
      }),
    ).rejects.toThrow('YOUTUBE_EXTRACTOR_INCOMPATIBLE');

    expect(getInfo).toHaveBeenCalledTimes(3);
  });

  it('no reintenta un video privado: falla de inmediato en el primer intento', async () => {
    const getInfo = vi.fn(async () => makeInfo([audioFormat()], { isPrivate: true }));
    const { logger, summaries } = recordingLogger();

    await expect(
      new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
        deps: { ytdl: makeYtdl(getInfo), fetch: okProbe as unknown as typeof fetch, logger },
      }),
    ).rejects.toThrow('YOUTUBE_PRIVATE_VIDEO');

    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(summaries.at(-1)).toMatchObject({ outcome: 'failure', errorCode: 'YOUTUBE_PRIVATE_VIDEO', attempts: 1 });
  });

  it('no reintenta si el video excede la duración máxima', async () => {
    const getInfo = vi.fn(async () => makeInfo([audioFormat()], { lengthSeconds: '99999' }));
    const { logger } = recordingLogger();

    await expect(
      new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
        maxDurationSeconds: 5400,
        deps: { ytdl: makeYtdl(getInfo), fetch: okProbe as unknown as typeof fetch, logger },
      }),
    ).rejects.toThrow('YOUTUBE_AUDIO_TOO_LONG');

    expect(getInfo).toHaveBeenCalledTimes(1);
  });

  it('el logging nunca incluye la URL firmada del CDN ni cabeceras', async () => {
    const getInfo = vi.fn(async () => makeInfo([audioFormat()]));
    const { logger, attempts } = recordingLogger();

    await new YtdlCoreAudioExtractor().extract(VIDEO_URL, {
      deps: { ytdl: makeYtdl(getInfo), fetch: okProbe as unknown as typeof fetch, logger },
    });

    const serialized = JSON.stringify(attempts);
    expect(serialized).not.toContain('googlevideo.com');
    expect(serialized).not.toMatch(/user-agent/i);
    expect(attempts[0]?.videoId).toBe('dQw4w9WgXcQ');
  });
});
