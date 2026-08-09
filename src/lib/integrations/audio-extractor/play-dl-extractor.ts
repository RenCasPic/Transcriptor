import type { Readable } from 'node:stream';
import type { AudioExtractor, ExtractAudioOptions, ExtractedAudio } from './types';

const INFO_TIMEOUT_MS = 20_000;
const STREAM_TIMEOUT_MS = 30_000;

const STREAM_TYPE_TO_FORMAT: Record<string, { extension: string; mimeType: string }> = {
  'webm/opus': { extension: 'webm', mimeType: 'audio/webm' },
  'ogg/opus': { extension: 'ogg', mimeType: 'audio/ogg' },
};

/**
 * Extrae el audio de un video de YouTube usando `play-dl`, una librería NO
 * oficial que replica lo que hace el reproductor web (mismo enfoque y mismo
 * trade-off ya aceptado en `youtube-transcript.ts` para los subtítulos):
 * funciona hoy y es gratis, pero YouTube puede cambiar su reproductor y
 * romperlo sin aviso, y su uso puede estar en zona gris de los Términos de
 * Servicio de YouTube. Se aísla detrás de `AudioExtractor` para poder
 * sustituirla por un mecanismo oficial más adelante sin tocar quien la usa.
 */
export class PlayDlAudioExtractor implements AudioExtractor {
  async extract(videoUrl: string, options: ExtractAudioOptions = {}): Promise<ExtractedAudio> {
    // Import dinámico (no en el top del archivo): si se cargara al evaluar
    // este módulo, Next.js también lo metería en el bundle "action-browser"
    // que arma la referencia cliente de las Server Actions, exactamente el
    // problema que rompió la página del editor con isomorphic-dompurify.
    // Cargarlo aquí adentro asegura que solo se evalúe en una petición real.
    const play = await import('play-dl');

    let info;
    try {
      info = await withTimeout(
        play.video_basic_info(videoUrl),
        INFO_TIMEOUT_MS,
        'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
      );
    } catch (error) {
      throw mapPlayDlError(error);
    }

    const details = info.video_details;
    if (details.private) throw new Error('YOUTUBE_PRIVATE_VIDEO');
    if (details.live) throw new Error('YOUTUBE_LIVE_UNSUPPORTED');
    if (options.maxDurationSeconds && details.durationInSec > options.maxDurationSeconds) {
      throw new Error('YOUTUBE_AUDIO_TOO_LONG');
    }

    let result;
    try {
      // quality: 0 = el bitrate de audio más bajo disponible. Alcanza de
      // sobra para transcribir voz y reduce el tiempo/memoria de descarga.
      result = await withTimeout(
        play.stream(videoUrl, { quality: 0 }),
        STREAM_TIMEOUT_MS,
        'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
      );
    } catch (error) {
      throw mapPlayDlError(error);
    }

    const format = STREAM_TYPE_TO_FORMAT[result.type];
    if (!format) {
      throw new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
    }

    return {
      stream: result.stream as Readable,
      fileExtension: format.extension,
      mimeType: format.mimeType,
      durationSeconds: details.durationInSec,
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
 * play-dl no expone errores tipados, solo mensajes en inglés pensados para
 * humanos. Este mapeo es un best-effort por coincidencia de texto: puede
 * dejar de funcionar si la librería cambia su redacción. Es la misma
 * fragilidad ya aceptada para el scraping de subtítulos, documentada aquí de
 * nuevo a propósito para no esconderla.
 */
export function mapPlayDlError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith('YOUTUBE_')) {
    return error;
  }
  const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (raw.includes('private')) return new Error('YOUTUBE_PRIVATE_VIDEO');
  if (raw.includes('sign in') || raw.includes('age')) return new Error('YOUTUBE_AGE_RESTRICTED');
  if (
    raw.includes('unavailable') ||
    raw.includes('removed') ||
    raw.includes('does not exist') ||
    raw.includes('not found') ||
    raw.includes('no longer available')
  ) {
    return new Error('YOUTUBE_VIDEO_NOT_FOUND');
  }
  if (raw.includes('region') || raw.includes('country')) return new Error('YOUTUBE_REGION_BLOCKED');
  return new Error('YOUTUBE_AUDIO_EXTRACTION_FAILED');
}
