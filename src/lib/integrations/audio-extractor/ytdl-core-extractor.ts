import type { Readable } from 'node:stream';
import type { AudioExtractor, ExtractAudioOptions, ExtractedAudio } from './types';

const INFO_TIMEOUT_MS = 20_000;

const AUDIO_MIME_PREFIX_TO_FORMAT: Array<{ prefix: string; extension: string; mimeType: string }> = [
  { prefix: 'audio/webm', extension: 'webm', mimeType: 'audio/webm' },
  { prefix: 'audio/mp4', extension: 'm4a', mimeType: 'audio/mp4' },
];

// Cuando la librería no logra parsear el reproductor de YouTube (el tipo de
// rotura que nos ocupa), por defecto escribe un archivo de depuración
// (`<timestamp>-player-script.js`) en el directorio de trabajo del proceso
// (ver `saveDebugFile` en su propio código). No queremos ese archivo
// huérfano en disco en cada fallo; la librería respeta esta variable para
// desactivarlo. Se fija aquí (no en .env) para que la protección no dependa
// de que alguien la configure en cada entorno.
if (process.env.YTDL_NO_DEBUG_FILE === undefined) {
  process.env.YTDL_NO_DEBUG_FILE = '1';
}

/**
 * Extrae el audio de un video de YouTube usando `@distube/ytdl-core`, un
 * fork mantenido activamente de `ytdl-core` (el original y `play-dl` llevan
 * desde 2023 sin publicar parches). Sigue siendo una librería NO oficial que
 * replica lo que hace el reproductor web: funciona mientras YouTube no
 * cambie el esquema de sus URLs firmadas, y deja de funcionar (sin aviso)
 * cuando lo cambia, hasta que el proyecto publique un parche — es el mismo
 * trade-off ya aceptado para el scraping de subtítulos.
 *
 * Recuperación cuando se publique una versión compatible: no requiere
 * ningún cambio en este archivo ni en quien lo consume
 * (`transcribeYoutubeAudioAction`). Basta con `npm update @distube/ytdl-core`
 * (el rango `^4.16.12` en package.json ya permite versiones más nuevas) — en
 * cuanto la librería vuelva a descifrar las URLs, `extract()` empieza a
 * devolver un stream válido en vez de lanzar `YOUTUBE_EXTRACTOR_INCOMPATIBLE`,
 * sin tocar `AudioExtractor` ni el resto del flujo.
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

    const audioOnlyFormats = ytdl.filterFormats(info.formats, 'audioonly');
    if (audioOnlyFormats.length === 0) {
      // El video en sí no tiene ningún track de solo-audio: es una
      // limitación real de ese contenido, no un problema del extractor.
      throw new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
    }

    // getInfo() ya intentó descifrar las firmas de cada formato. Si el
    // esquema de YouTube cambió y la librería todavía no lo sabe descifrar,
    // los formatos existen como objetos pero ninguno trae una `url`
    // resuelta — es la firma exacta de una incompatibilidad del extractor
    // con el reproductor actual (ver mapYtdlError), distinta de que el
    // video simplemente no tenga pista de audio.
    const resolvedFormats = audioOnlyFormats
      .filter((format) => !!format.url)
      .sort((a, b) => (a.audioBitrate ?? Infinity) - (b.audioBitrate ?? Infinity));

    const format = resolvedFormats[0];
    if (!format) {
      throw new Error('YOUTUBE_EXTRACTOR_INCOMPATIBLE:no resolved audio format URL');
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

// Fragmentos (en inglés, tal como los redacta la librería) que indican
// específicamente que el fallo es una incompatibilidad de descifrado entre
// @distube/ytdl-core y el reproductor actual de YouTube — no un video
// privado/eliminado/con restricción de edad, no un timeout, no un error de
// Groq ni un bug propio. Ver tests/unit/ytdl-core-error-mapping.test.ts.
const EXTRACTOR_INCOMPATIBILITY_PATTERNS = ['decipher', 'n transform', 'playable format', 'signature'];

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
  if (EXTRACTOR_INCOMPATIBILITY_PATTERNS.some((pattern) => raw.includes(pattern))) {
    return new Error(`YOUTUBE_EXTRACTOR_INCOMPATIBLE:${original}`);
  }
  // Sin coincidencia conocida (p. ej. un error de red genuinamente
  // transitorio): se conserva el mensaje original para diagnosticar sin
  // acceso a los logs del servidor, pero SIN clasificarlo como
  // incompatibilidad del extractor — ver translateAudioFallbackError.
  return new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${original}`);
}
