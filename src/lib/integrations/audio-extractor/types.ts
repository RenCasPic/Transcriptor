import type { Readable } from 'node:stream';

export interface ExtractedAudio {
  stream: Readable;
  fileExtension: string;
  mimeType: string;
  durationSeconds: number;
  title: string;
}

export interface ExtractAudioOptions {
  maxDurationSeconds?: number;
}

/**
 * Abstracción sobre la extracción de audio de un video de una plataforma
 * externa (hoy solo YouTube, ver `play-dl-extractor.ts` para la única
 * implementación y su trade-off). Aislar esto detrás de una interfaz permite
 * sustituir el mecanismo (hoy una librería no oficial) por un proveedor
 * oficial más adelante sin tocar quien la consume.
 */
export interface AudioExtractor {
  extract(videoUrl: string, options?: ExtractAudioOptions): Promise<ExtractedAudio>;
}
