import type { Readable } from 'node:stream';
import type { ExtractionLogger } from './extraction-logger';

export interface ExtractedAudio {
  stream: Readable;
  fileExtension: string;
  mimeType: string;
  durationSeconds: number;
  title: string;
}

export interface ExtractAudioOptions {
  maxDurationSeconds?: number;
  /**
   * Inyección de dependencias para tests (mismo patrón que
   * `TranscriptionJobDeps`). En producción se dejan sin definir y se usan las
   * reales: `@distube/ytdl-core`, el `fetch` global y el logger de consola.
   */
  deps?: {
    // Tipado laxo a propósito: la superficie de `@distube/ytdl-core` que
    // usamos es mínima y su typing real no aporta aquí.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ytdl?: any;
    fetch?: typeof fetch;
    logger?: ExtractionLogger;
    /** yt-dlp: `spawn` inyectable y ruta al binario, para tests. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spawn?: any;
    /**
     * Ruta al binario. Si la clave está presente (incluido `null`) se usa tal
     * cual y NO se llama a `resolveYtDlpBinary()` — `null` simula "no hay
     * binario" en tests.
     */
    binaryPath?: string | null;
    ytdlpVersion?: string;
  };
}

/**
 * Abstracción sobre la extracción de audio de un video de una plataforma
 * externa (hoy solo YouTube, ver `ytdl-core-extractor.ts` para la única
 * implementación y su trade-off). Aislar esto detrás de una interfaz permite
 * sustituir el mecanismo (hoy una librería no oficial) por un proveedor
 * oficial más adelante sin tocar quien la consume.
 */
export interface AudioExtractor {
  extract(videoUrl: string, options?: ExtractAudioOptions): Promise<ExtractedAudio>;
}
