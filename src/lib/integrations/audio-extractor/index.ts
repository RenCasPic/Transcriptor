import type { AudioExtractor } from './types';
import { YtdlCoreAudioExtractor } from './ytdl-core-extractor';

export type { AudioExtractor, ExtractedAudio, ExtractAudioOptions } from './types';

/**
 * Fábrica del extractor de audio, con el mismo patrón que
 * `getTranscriptionProvider()`: un único punto de construcción para poder
 * sustituir la implementación (hoy `@distube/ytdl-core`, no oficial) por
 * otra futura sin tocar el código que la usa
 * (`transcribeYoutubeAudioAction`). Se probó primero con `play-dl`, pero esa
 * librería lleva sin publicar cambios desde 2023 y falla contra el
 * reproductor actual de YouTube; `@distube/ytdl-core` se mantiene activo
 * justo para este tipo de roturas, aunque no está garantizado que siempre
 * esté al día (ver comentarios en `ytdl-core-extractor.ts`).
 */
export function getAudioExtractor(): AudioExtractor {
  return new YtdlCoreAudioExtractor();
}
