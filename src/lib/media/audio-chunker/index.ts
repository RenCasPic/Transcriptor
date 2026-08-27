import type { AudioChunker } from './types';
import { FfmpegAudioChunker } from './ffmpeg-chunker';
import { resolveFfmpegBinaries } from './ffmpeg';

export type {
  AudioChunk,
  AudioChunker,
  AudioChunkerResult,
  ChunkAudioInput,
  ChunkAudioOptions,
} from './types';

/**
 * Fábrica del troceador de audio, con el mismo patrón que
 * `getTranscriptionProvider()` / `getAudioExtractor()`. Hoy solo existe la
 * implementación con ffmpeg; sustituirla (p. ej. por un servicio de
 * transcodificación gestionado) no requiere tocar el procesador de jobs.
 */
export function getAudioChunker(): AudioChunker {
  return new FfmpegAudioChunker();
}

/**
 * Indica si el entorno puede trocear audio (ffmpeg disponible). El procesador
 * lo consulta antes de aceptar un archivo que supera el límite del proveedor:
 * si no hay troceador, falla con un error explícito y recuperable en vez de
 * intentarlo y reventar a mitad.
 */
export async function isAudioChunkingAvailable(): Promise<boolean> {
  return (await resolveFfmpegBinaries()) !== null;
}
