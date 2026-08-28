import type { AudioExtractor } from './types';
import { YtDlpAudioExtractor } from './ytdlp-extractor';
import { YtdlCoreAudioExtractor } from './ytdl-core-extractor';

export type { AudioExtractor, ExtractedAudio, ExtractAudioOptions } from './types';

/**
 * Fábrica del extractor de audio, con el mismo patrón que
 * `getTranscriptionProvider()`: un único punto de construcción para poder
 * sustituir la implementación sin tocar el código que la usa
 * (`transcribeYoutubeAudioAction`).
 *
 * Por defecto usa **yt-dlp** (`YtDlpAudioExtractor`): a fecha de 2026 es la
 * única vía que sigue funcionando para bajar audio de YouTube — las
 * librerías JS puras (`@distube/ytdl-core`, `youtubei.js`) quedaron obsoletas
 * cuando YouTube pasó la entrega a SABR, y un PO Token no lo arregla (probado
 * empíricamente).
 *
 * `AUDIO_EXTRACTOR=ytdl-core` fuerza el extractor JS anterior (archivado, casi
 * siempre falla hoy) — solo como escape de emergencia si el binario de yt-dlp
 * no estuviera disponible en algún entorno.
 */
export function getAudioExtractor(): AudioExtractor {
  if (process.env.AUDIO_EXTRACTOR === 'ytdl-core') {
    return new YtdlCoreAudioExtractor();
  }
  return new YtDlpAudioExtractor();
}
