import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAudioChunker, isAudioChunkingAvailable } from '@/lib/media/audio-chunker';
import { resolveFfmpegBinaries } from '@/lib/media/audio-chunker/ffmpeg';

let available = false;
let ffmpegPath = '';

beforeAll(async () => {
  available = await isAudioChunkingAvailable();
  const bins = await resolveFfmpegBinaries();
  ffmpegPath = bins?.ffmpeg ?? '';
});

describe('FfmpegAudioChunker (integración, requiere ffmpeg)', () => {
  it('trocea un audio real respetando el orden y el offset temporal de cada chunk', async () => {
    if (!available || !ffmpegPath) {
      // Sin ffmpeg en el entorno: el troceo no aplica (el procesador falla con
      // MEDIA_REQUIRES_CHUNKING_UNAVAILABLE, cubierto en transcription-pipeline.test.ts).
      return;
    }

    // 5 s de tono generado en memoria por ffmpeg (lavfi), como si fuera la
    // subida del usuario.
    const generated = spawnSync(
      ffmpegPath,
      ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-f', 'mp3', 'pipe:1'],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    expect(generated.status).toBe(0);
    const audio = generated.stdout;
    expect(audio.length).toBeGreaterThan(0);

    const { chunks, totalDurationSeconds } = await getAudioChunker().chunk(
      { stream: Readable.from(audio), sourceExtension: 'mp3' },
      { targetBytes: 20 * 1024 * 1024, maxSeconds: 2, audioBitrateKbps: 64, maxTotalSeconds: 3600 },
    );

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    // startSeconds monótono creciente en pasos de 2 s
    expect(chunks.map((c) => c.startSeconds)).toEqual(chunks.map((_, i) => i * 2));
    for (const chunk of chunks) {
      expect(chunk.blob.size).toBeGreaterThan(0);
      expect(chunk.fileExtension).toBe('mp3');
    }
    expect(totalDurationSeconds).toBeGreaterThan(3);
  }, 30_000);
});
