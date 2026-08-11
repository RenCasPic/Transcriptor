import type { Readable } from 'node:stream';
import type { AudioExtractor, ExtractAudioOptions, ExtractedAudio } from './types';

const INFO_TIMEOUT_MS = 20_000;

const AUDIO_MIME_PREFIX_TO_FORMAT: Array<{ prefix: string; extension: string; mimeType: string }> = [
  { prefix: 'audio/webm', extension: 'webm', mimeType: 'audio/webm' },
  { prefix: 'audio/mp4', extension: 'm4a', mimeType: 'audio/mp4' },
];

/**
 * Extrae el audio de un video de YouTube usando `@distube/ytdl-core`, un
 * fork mantenido activamente de `ytdl-core` (el original y `play-dl` llevan
 * tiempo sin publicar parches, ver historial en el repo). Sigue siendo una
 * librería NO oficial que replica lo que hace el reproductor web: funciona
 * mientras YouTube no cambie el esquema de sus URLs firmadas, y deja de
 * funcionar (sin aviso) cuando lo cambia, hasta que el proyecto publique un
 * parche. Es el mismo trade-off ya aceptado para el scraping de subtítulos,
 * documentado aquí de nuevo a propósito.
 */
export class YtdlCoreAudioExtractor implements AudioExtractor {
  async extract(videoUrl: string, options: ExtractAudioOptions = {}): Promise<ExtractedAudio> {
    // Import dinámico: si se cargara al evaluar este módulo, Next.js también
    // lo metería en el bundle "action-browser" que arma la referencia
    // cliente de las Server Actions — el mismo problema que rompió la
    // página del editor con isomorphic-dompurify.
    const ytdl = (await import('@distube/ytdl-core')).default;

    let info;
    try {
      info = await withTimeout(ytdl.getInfo(videoUrl), INFO_TIMEOUT_MS, 'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT');
    } catch (error) {
      throw mapYtdlError(error);
    }

    const details = info.videoDetails;
    if (details.isPrivate) throw new Error('YOUTUBE_PRIVATE_VIDEO');
    if (details.isLiveContent) throw new Error('YOUTUBE_LIVE_UNSUPPORTED');

    const durationSeconds = Number(details.lengthSeconds) || 0;
    if (options.maxDurationSeconds && durationSeconds > options.maxDurationSeconds) {
      throw new Error('YOUTUBE_AUDIO_TOO_LONG');
    }

    // Solo-audio y con URL ya resuelta (getInfo descifra las firmas; si
    // YouTube cambió ese esquema y la librería no lo sabe descifrar todavía,
    // el formato queda sin `url` y se descarta aquí en vez de intentar
    // descargar con una URL inválida).
    const audioFormats = ytdl
      .filterFormats(info.formats, 'audioonly')
      .filter((format) => !!format.url)
      .sort((a, b) => (a.audioBitrate ?? Infinity) - (b.audioBitrate ?? Infinity));

    const format = audioFormats[0];
    if (!format) {
      throw new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
    }

    const mapped = AUDIO_MIME_PREFIX_TO_FORMAT.find((entry) => format.mimeType?.startsWith(entry.prefix));
    if (!mapped) {
      throw new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
    }

    let stream: Readable;
    try {
      stream = ytdl.downloadFromInfo(info, { format });
    } catch (error) {
      throw mapYtdlError(error);
    }

    return {
      stream,
      fileExtension: mapped.extension,
      mimeType: mapped.mimeType,
      durationSeconds,
      title: details.title || 'Video de YouTube',
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutErrorCode: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutErrorCode)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * `@distube/ytdl-core` no expone errores tipados, solo mensajes en inglés
 * pensados para humanos. Este mapeo es un best-effort por coincidencia de
 * texto: puede dejar de funcionar si la librería cambia su redacción. Es la
 * misma fragilidad ya aceptada para el scraping de subtítulos.
 */
export function mapYtdlError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith('YOUTUBE_')) {
    return error;
  }
  const original = error instanceof Error ? error.message : String(error);
  const raw = original.toLowerCase();
  if (raw.includes('private')) return new Error('YOUTUBE_PRIVATE_VIDEO');
  if (raw.includes('sign in') || raw.includes('age')) return new Error('YOUTUBE_AGE_RESTRICTED');
  if (
    raw.includes('unavailable') ||
    raw.includes('removed') ||
    raw.includes('no video id found') ||
    raw.includes('no longer available')
  ) {
    return new Error('YOUTUBE_VIDEO_NOT_FOUND');
  }
  if (raw.includes('region') || raw.includes('country')) return new Error('YOUTUBE_REGION_BLOCKED');
  // Sin coincidencia conocida: se conserva el mensaje original (después de
  // los dos puntos) para poder diagnosticar sin acceso a los logs del
  // servidor — ver translateAudioFallbackError. Este es también el caso que
  // cubre las fallas de "no se pudo descifrar la firma", el tipo de rotura
  // más común cuando YouTube cambia su reproductor.
  return new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${original}`);
}
