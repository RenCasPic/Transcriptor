import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { YtDlpAudioExtractor, mapYtDlpError } from '@/lib/integrations/audio-extractor/ytdlp-extractor';
import type {
  ExtractionAttemptRecord,
  ExtractionLogger,
  ExtractionSummaryRecord,
} from '@/lib/integrations/audio-extractor/extraction-logger';

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/** Child de metadata/version: emite stdout y cierra. */
function fakeChild(opts: { stdout?: string; stderr?: string; exitCode?: number }) {
  const child = new EventEmitter() as EventEmitter & { stdout: Readable; stderr: Readable; kill: () => boolean };
  child.stdout = Readable.from(opts.stdout ? [Buffer.from(opts.stdout)] : []);
  child.stderr = Readable.from(opts.stderr ? [Buffer.from(opts.stderr)] : []);
  child.kill = () => true;
  process.nextTick(() => {
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      process.nextTick(() => child.emit('close', opts.exitCode ?? 0));
    };
    child.stdout.on('end', close);
    setTimeout(close, 20);
  });
  return child;
}

function makeSpawn(handlers: { metadata?: () => ReturnType<typeof fakeChild> } = {}) {
  return vi.fn((_bin: string, args: string[]) => {
    if (args.includes('--version')) return fakeChild({ stdout: '2026.08.19\n' });
    if (args.includes('-J')) return (handlers.metadata ?? (() => fakeChild({ stdout: '{}' })))();
    return fakeChild({ stdout: '' });
  });
}

/** downloadAudio inyectado: sustituye la descarga+recompresión real (que toca disco). */
function fakeDownload(bytes = 'AUDIODATA', overrides: Partial<{ fileExtension: string; mimeType: string; compressed: boolean }> = {}) {
  const cleanup = vi.fn();
  return {
    cleanup,
    fn: vi.fn(async () => ({
      stream: Readable.from([Buffer.from(bytes)]),
      fileExtension: 'mp3',
      mimeType: 'audio/mpeg',
      compressed: true,
      cleanup,
      ...overrides,
    })),
  };
}

function recordingLogger() {
  const attempts: ExtractionAttemptRecord[] = [];
  const summaries: ExtractionSummaryRecord[] = [];
  const logger: ExtractionLogger = { attempt: (r) => attempts.push(r), summary: (r) => summaries.push(r) };
  return { logger, attempts, summaries };
}

const META_OK = JSON.stringify({ title: 'A talk', duration: 356, is_live: false, availability: 'public' });

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}
const flush = () => new Promise((r) => setImmediate(r));

describe('YtDlpAudioExtractor', () => {
  it('metadata -> descarga (mp3 comprimido) -> stream; limpia el temporal al cerrar', async () => {
    const spawn = makeSpawn({ metadata: () => fakeChild({ stdout: META_OK }) });
    const dl = fakeDownload('ID3AUDIODATA');
    const { logger, attempts, summaries } = recordingLogger();

    const result = await new YtDlpAudioExtractor().extract(URL, {
      deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: '2026.08.19', logger, downloadAudio: dl.fn },
    });

    expect(result.fileExtension).toBe('mp3');
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.durationSeconds).toBe(356);
    expect(result.title).toBe('A talk');
    expect((await readAll(result.stream)).toString()).toBe('ID3AUDIODATA');

    await flush();
    expect(dl.cleanup).toHaveBeenCalled();
    expect(attempts[0]).toMatchObject({ outcome: 'success', strategy: 'yt-dlp', requestedFormat: 'mp3 32k mono 16kHz' });
    expect(summaries[0]).toMatchObject({ outcome: 'success', winningStrategy: 'yt-dlp' });
  });

  it('lanza AUDIO_EXTRACTOR_UNAVAILABLE si no hay binario', async () => {
    await expect(
      new YtDlpAudioExtractor().extract(URL, { deps: { spawn: makeSpawn(), binaryPath: null } }),
    ).rejects.toThrow('AUDIO_EXTRACTOR_UNAVAILABLE');
  });

  it('propaga YOUTUBE_PRIVATE_VIDEO desde el exit code de la metadata', async () => {
    const spawn = makeSpawn({
      metadata: () =>
        fakeChild({ stderr: 'ERROR: [youtube] xxxx: Private video. Sign in if you have been granted access', exitCode: 1 }),
    });
    const dl = fakeDownload();
    await expect(
      new YtDlpAudioExtractor().extract(URL, {
        deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x', downloadAudio: dl.fn },
      }),
    ).rejects.toThrow('YOUTUBE_PRIVATE_VIDEO');
    expect(dl.fn).not.toHaveBeenCalled();
  });

  it('respeta maxDurationSeconds antes de descargar', async () => {
    const spawn = makeSpawn({
      metadata: () => fakeChild({ stdout: JSON.stringify({ title: 't', duration: 9999, availability: 'public' }) }),
    });
    const dl = fakeDownload();
    await expect(
      new YtDlpAudioExtractor().extract(URL, {
        maxDurationSeconds: 5400,
        deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x', downloadAudio: dl.fn },
      }),
    ).rejects.toThrow('YOUTUBE_AUDIO_TOO_LONG');
    expect(dl.fn).not.toHaveBeenCalled();
  });

  it('propaga y registra un fallo de la descarga (p. ej. 403 -> bloqueado)', async () => {
    const spawn = makeSpawn({ metadata: () => fakeChild({ stdout: META_OK }) });
    const { logger, summaries } = recordingLogger();
    await expect(
      new YtDlpAudioExtractor().extract(URL, {
        deps: {
          spawn,
          binaryPath: '/fake/yt-dlp',
          ytdlpVersion: 'x',
          logger,
          downloadAudio: vi.fn(async () => {
            throw new Error('YOUTUBE_EXTRACTOR_BLOCKED');
          }),
        },
      }),
    ).rejects.toThrow('YOUTUBE_EXTRACTOR_BLOCKED');
    expect(summaries.at(-1)).toMatchObject({ outcome: 'failure', errorCode: 'YOUTUBE_EXTRACTOR_BLOCKED' });
  });

  it('el logging no incluye la URL del vídeo entera', async () => {
    const spawn = makeSpawn({ metadata: () => fakeChild({ stdout: META_OK }) });
    const { logger, attempts } = recordingLogger();
    await new YtDlpAudioExtractor().extract(URL, {
      deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x', logger, downloadAudio: fakeDownload().fn },
    });
    expect(attempts[0]?.videoId).toBe('dQw4w9WgXcQ');
    expect(JSON.stringify(attempts)).not.toContain('youtube.com/watch');
  });
});

describe('mapYtDlpError', () => {
  const cases: Array<[string, string]> = [
    ['ERROR: Private video. Sign in if you have been granted access to this video', 'YOUTUBE_PRIVATE_VIDEO'],
    ['ERROR: Join this channel to get access to members-only content', 'YOUTUBE_MEMBERS_ONLY'],
    ['ERROR: Sign in to confirm your age. This video may be inappropriate for some users', 'YOUTUBE_AGE_RESTRICTED'],
    ["ERROR: Sign in to confirm you're not a bot", 'YOUTUBE_EXTRACTOR_BLOCKED'],
    ['ERROR: unable to download video data: HTTP Error 403: Forbidden', 'YOUTUBE_EXTRACTOR_BLOCKED'],
    ['ERROR: [youtube] dQw4: Video unavailable. This video has been removed by the uploader', 'YOUTUBE_VIDEO_NOT_FOUND'],
    ['ERROR: The uploader has not made this video available in your country', 'YOUTUBE_REGION_BLOCKED'],
    ['ERROR: requested format is not available. Use --list-formats', 'YOUTUBE_AUDIO_FORMAT_UNSUPPORTED'],
    ['ERROR: This live event will begin in 3 hours', 'YOUTUBE_LIVE_UNSUPPORTED'],
  ];
  for (const [stderr, code] of cases) {
    it(`"${stderr.slice(7, 45)}..." -> ${code}`, () => {
      expect(mapYtDlpError(stderr, 1).message).toBe(code);
    });
  }

  it('un fallo de descifrado del reproductor -> YOUTUBE_EXTRACTOR_INCOMPATIBLE con detalle', () => {
    const err = mapYtDlpError('ERROR: [youtube] Unable to extract nsig; player = ...', 1);
    expect(err.message.startsWith('YOUTUBE_EXTRACTOR_INCOMPATIBLE:')).toBe(true);
  });

  it('lo desconocido cae en YOUTUBE_AUDIO_EXTRACTION_FAILED', () => {
    expect(mapYtDlpError('ERROR: something weird happened', 1).message).toMatch(/^YOUTUBE_AUDIO_EXTRACTION_FAILED:/);
  });
});
