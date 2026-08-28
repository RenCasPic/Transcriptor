import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { YtDlpAudioExtractor } from '@/lib/integrations/audio-extractor/ytdlp-extractor';
import { mapYtDlpError } from '@/lib/integrations/audio-extractor/ytdlp-extractor';
import type { ExtractionAttemptRecord, ExtractionLogger, ExtractionSummaryRecord } from '@/lib/integrations/audio-extractor/extraction-logger';

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function fakeChild(opts: { stdout?: Array<string | Buffer>; stderr?: string; exitCode?: number; error?: Error }) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: Readable;
    stderr: Readable;
    kill: (s?: string) => boolean;
    killed: boolean;
  };
  child.stdout = Readable.from((opts.stdout ?? []).map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c))));
  child.stderr = Readable.from(opts.stderr ? [Buffer.from(opts.stderr)] : []);
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.stdout.destroy();
    return true;
  };
  process.nextTick(() => {
    if (opts.error) {
      child.emit('error', opts.error);
      return;
    }
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      process.nextTick(() => child.emit('close', opts.exitCode ?? 0));
    };
    child.stdout.on('end', close);
    child.stdout.on('close', close);
    setTimeout(close, 30);
  });
  return child;
}

/** Router de spawn: decide la respuesta según los argumentos de yt-dlp. */
function makeSpawn(handlers: {
  version?: () => ReturnType<typeof fakeChild>;
  metadata?: () => ReturnType<typeof fakeChild>;
  download?: () => ReturnType<typeof fakeChild>;
}) {
  return vi.fn((_bin: string, args: string[]) => {
    if (args.includes('--version')) return (handlers.version ?? (() => fakeChild({ stdout: ['2026.08.19\n'] })))();
    if (args.includes('-J')) return (handlers.metadata ?? (() => fakeChild({ stdout: ['{}'] })))();
    return (handlers.download ?? (() => fakeChild({ stdout: ['audio-bytes'] })))();
  });
}

function recordingLogger() {
  const attempts: ExtractionAttemptRecord[] = [];
  const summaries: ExtractionSummaryRecord[] = [];
  const logger: ExtractionLogger = { attempt: (r) => attempts.push(r), summary: (r) => summaries.push(r) };
  return { logger, attempts, summaries };
}

const META_OK = JSON.stringify({
  title: 'A talk',
  duration: 356,
  is_live: false,
  availability: 'public',
  requested_downloads: [{ format_id: '140', ext: 'm4a', acodec: 'mp4a.40.2', vcodec: 'none' }],
});

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

describe('YtDlpAudioExtractor', () => {
  it('extrae audio: metadata -> stream, con extensión/mime del formato elegido', async () => {
    const spawn = makeSpawn({
      metadata: () => fakeChild({ stdout: [META_OK] }),
      download: () => fakeChild({ stdout: ['ID3AUDIODATA'] }),
    });
    const { logger, attempts, summaries } = recordingLogger();

    const result = await new YtDlpAudioExtractor().extract(URL, {
      deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: '2026.08.19', logger },
    });

    expect(result.fileExtension).toBe('m4a');
    expect(result.mimeType).toBe('audio/mp4');
    expect(result.durationSeconds).toBe(356);
    expect(result.title).toBe('A talk');
    expect((await readAll(result.stream)).toString()).toBe('ID3AUDIODATA');

    // download se pidió con el format_id exacto de la metadata
    const dlCall = spawn.mock.calls.find((c) => (c[1] as string[]).includes('-o'));
    expect(dlCall?.[1]).toEqual(expect.arrayContaining(['-f', '140', '-o', '-']));
    expect(attempts[0]).toMatchObject({ outcome: 'success', strategy: 'yt-dlp', extractorVersion: '2026.08.19' });
    expect(summaries[0]).toMatchObject({ outcome: 'success', winningStrategy: 'yt-dlp' });
  });

  it('lanza AUDIO_EXTRACTOR_UNAVAILABLE si no hay binario', async () => {
    await expect(
      new YtDlpAudioExtractor().extract(URL, { deps: { spawn: makeSpawn({}), binaryPath: null } }),
    ).rejects.toThrow('AUDIO_EXTRACTOR_UNAVAILABLE');
  });

  it('propaga YOUTUBE_PRIVATE_VIDEO desde el exit code de la metadata', async () => {
    const spawn = makeSpawn({
      metadata: () =>
        fakeChild({ stderr: 'ERROR: [youtube] xxxx: Private video. Sign in if you have been granted access', exitCode: 1 }),
    });
    await expect(
      new YtDlpAudioExtractor().extract(URL, { deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x' } }),
    ).rejects.toThrow('YOUTUBE_PRIVATE_VIDEO');
  });

  it('clasifica "Sign in to confirm you\'re not a bot" como YOUTUBE_EXTRACTOR_BLOCKED', async () => {
    const spawn = makeSpawn({
      metadata: () =>
        fakeChild({ stderr: "ERROR: [youtube] Sign in to confirm you're not a bot. Use --cookies-from-browser", exitCode: 1 }),
    });
    const { logger, summaries } = recordingLogger();
    await expect(
      new YtDlpAudioExtractor().extract(URL, { deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x', logger } }),
    ).rejects.toThrow('YOUTUBE_EXTRACTOR_BLOCKED');
    expect(summaries.at(-1)?.errorCode).toBe('YOUTUBE_EXTRACTOR_BLOCKED');
  });

  it('respeta maxDurationSeconds', async () => {
    const spawn = makeSpawn({
      metadata: () => fakeChild({ stdout: [JSON.stringify({ title: 't', duration: 9999, availability: 'public' })] }),
    });
    await expect(
      new YtDlpAudioExtractor().extract(URL, {
        maxDurationSeconds: 5400,
        deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x' },
      }),
    ).rejects.toThrow('YOUTUBE_AUDIO_TOO_LONG');
  });

  it('si el download sale con error tras emitir bytes, el stream emite error (no un audio truncado)', async () => {
    const spawn = makeSpawn({
      metadata: () => fakeChild({ stdout: [META_OK] }),
      download: () => fakeChild({ stdout: ['partial'], stderr: 'ERROR: unable to download video data: HTTP Error 403: Forbidden', exitCode: 1 }),
    });
    const result = await new YtDlpAudioExtractor().extract(URL, {
      deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x' },
    });
    await expect(readAll(result.stream)).rejects.toThrow('YOUTUBE_EXTRACTOR_BLOCKED');
  });

  it('el logging no incluye la URL del vídeo entera ni el stderr crudo', async () => {
    const spawn = makeSpawn({ metadata: () => fakeChild({ stdout: [META_OK] }) });
    const { logger, attempts } = recordingLogger();
    await new YtDlpAudioExtractor().extract(URL, {
      deps: { spawn, binaryPath: '/fake/yt-dlp', ytdlpVersion: 'x', logger },
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
