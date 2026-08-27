import type { AudioChunk, AudioChunker, AudioChunkerResult, ChunkAudioInput, ChunkAudioOptions } from './types';
import {
  cleanupTempDir,
  makeTempDir,
  probeDurationSeconds,
  readFileAsBlob,
  resolveFfmpegBinaries,
  segmentAudio,
  streamToTempFile,
} from './ffmpeg';

const CHUNK_MIME_TYPE = 'audio/mpeg';
const CHUNK_EXTENSION = 'mp3';

/**
 * Implementación de `AudioChunker` basada en ffmpeg (binario estático de
 * `@ffmpeg-installer/ffmpeg`). Estrategia:
 *
 * 1. Vuelca el stream de entrada a un archivo temporal en disco (no en RAM).
 * 2. Lee la duración con ffprobe.
 * 3. Extrae y trocea el audio en mp3 mono con `-f segment` (ffmpeg lo hace de
 *    forma secuencial, sin cargar el archivo completo en memoria).
 * 4. Devuelve cada segmento como Blob con su offset temporal.
 *
 * La duración de cada segmento se calcula para que el archivo resultante
 * quede por debajo de `targetBytes` al bitrate elegido, con tope en
 * `maxSeconds`.
 */
export class FfmpegAudioChunker implements AudioChunker {
  async chunk(input: ChunkAudioInput, options: ChunkAudioOptions): Promise<AudioChunkerResult> {
    const binaries = await resolveFfmpegBinaries();
    if (!binaries) {
      throw new Error('AUDIO_CHUNKER_UNAVAILABLE');
    }

    const dir = await makeTempDir();
    try {
      const inputExt = (input.sourceExtension ?? 'bin').replace(/^\./, '').toLowerCase() || 'bin';
      const inputPath = await streamToTempFile(input.stream, dir, `source.${inputExt}`);

      const totalDurationSeconds = await probeDurationSeconds(binaries.ffprobe, inputPath);
      if (totalDurationSeconds > 0 && totalDurationSeconds > options.maxTotalSeconds) {
        throw new Error('MEDIA_DURATION_EXCEEDED');
      }

      const secondsForTargetSize = Math.max(
        1,
        Math.floor((options.targetBytes * 8) / (options.audioBitrateKbps * 1000)),
      );
      // El troceo lo gobierna la duración (más predecible que el tamaño); el
      // tamaño objetivo solo lo acota hacia abajo. Mínimo de 1 s para no
      // pisar un `maxSeconds` pequeño (útil en tests).
      const segmentSeconds = Math.max(1, Math.min(options.maxSeconds, secondsForTargetSize));

      const segmentPaths = await segmentAudio(binaries.ffmpeg, inputPath, dir, {
        segmentSeconds,
        audioBitrateKbps: options.audioBitrateKbps,
      });

      if (segmentPaths.length === 0) {
        throw new Error('AUDIO_CHUNKING_PRODUCED_NO_OUTPUT');
      }

      const chunks: AudioChunk[] = [];
      for (let index = 0; index < segmentPaths.length; index++) {
        const startSeconds = index * segmentSeconds;
        const endSeconds =
          totalDurationSeconds > 0
            ? Math.min((index + 1) * segmentSeconds, totalDurationSeconds)
            : (index + 1) * segmentSeconds;
        const blob = await readFileAsBlob(segmentPaths[index]!, CHUNK_MIME_TYPE);
        chunks.push({
          index,
          startSeconds,
          endSeconds,
          blob,
          fileExtension: CHUNK_EXTENSION,
          mimeType: CHUNK_MIME_TYPE,
        });
      }

      return {
        chunks,
        totalDurationSeconds: totalDurationSeconds || chunks[chunks.length - 1]!.endSeconds,
      };
    } finally {
      await cleanupTempDir(dir);
    }
  }
}
