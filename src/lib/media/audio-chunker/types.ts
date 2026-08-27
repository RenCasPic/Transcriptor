import type { Readable } from 'node:stream';

export interface AudioChunk {
  /** Posición del chunk dentro del audio original (0, 1, 2, ...). */
  index: number;
  /** Segundo del audio original en el que empieza este chunk. */
  startSeconds: number;
  /** Segundo del audio original en el que termina este chunk. */
  endSeconds: number;
  /** Audio del chunk, ya re-codificado y por debajo del límite del proveedor. */
  blob: Blob;
  /** Extensión (sin punto) del audio del chunk, p. ej. "mp3". */
  fileExtension: string;
  mimeType: string;
}

export interface ChunkAudioOptions {
  /** Tamaño objetivo (bytes) de cada chunk. */
  targetBytes: number;
  /** Duración máxima (segundos) de cada chunk. */
  maxSeconds: number;
  /** Bitrate (kbps) del audio mono re-codificado. */
  audioBitrateKbps: number;
  /** Duración máxima (segundos) del audio completo; se rechaza si la supera. */
  maxTotalSeconds: number;
}

export interface ChunkAudioInput {
  /** Stream del archivo de medios original (audio o video). */
  stream: Readable;
  /** Extensión del archivo original, si se conoce (ayuda a ffmpeg a elegir demuxer). */
  sourceExtension?: string;
}

export interface AudioChunkerResult {
  chunks: AudioChunk[];
  totalDurationSeconds: number;
}

/**
 * Abstracción sobre "partir un archivo de audio/video grande en trozos de
 * audio pequeños que quepan en una petición del proveedor de transcripción".
 * Aislada detrás de una interfaz (mismo patrón que `AudioExtractor` y
 * `TranscriptionProvider`) para poder sustituir ffmpeg por otro mecanismo sin
 * tocar el procesador de jobs.
 */
export interface AudioChunker {
  chunk(input: ChunkAudioInput, options: ChunkAudioOptions): Promise<AudioChunkerResult>;
}
