import type { AudioExtractor } from './types';
import { PlayDlAudioExtractor } from './play-dl-extractor';

export type { AudioExtractor, ExtractedAudio, ExtractAudioOptions } from './types';

/**
 * Fábrica del extractor de audio, con el mismo patrón que
 * `getTranscriptionProvider()`: un único punto de construcción para poder
 * sustituir la implementación (hoy `play-dl`, no oficial) por otra futura
 * sin tocar el código que la usa (`transcribeYoutubeAudioAction`).
 */
export function getAudioExtractor(): AudioExtractor {
  return new PlayDlAudioExtractor();
}
