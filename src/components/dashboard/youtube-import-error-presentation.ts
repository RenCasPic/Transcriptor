import type { Dictionary } from '@/lib/i18n/dictionaries';

type ImportErrorCopy = Dictionary['dashboard']['importError'];

/**
 * Traduce el `code` de un error de importación de YouTube a lo que muestra
 * `ImportErrorPanel`: un título y una lista de sugerencias. Vive aparte
 * porque lo consumen dos entradas distintas (la tarjeta del dashboard y el
 * panel de fuentes de un proyecto) y antes estaba duplicado en ambas.
 *
 * Los `code` provienen de `extractYoutubeErrorCode(...)` en el servidor
 * (`src/lib/actions/youtube-errors.ts`), sin el `:detalle`.
 */
export function youtubeImportErrorPresentation(
  code: string,
  copy: ImportErrorCopy,
): { title: string; tips: string[] } {
  switch (code) {
    case 'YOUTUBE_EXTRACTOR_BLOCKED':
      return {
        title: copy.extractorBlockedTitle,
        tips: [copy.extractorBlockedTip1, copy.extractorBlockedTip2],
      };
    case 'YOUTUBE_EXTRACTOR_INCOMPATIBLE':
      return {
        title: copy.extractorIncompatibleTitle,
        tips: [copy.extractorIncompatibleTip1, copy.extractorIncompatibleTip2],
      };
    case 'YOUTUBE_PRIVATE_VIDEO':
    case 'YOUTUBE_MEMBERS_ONLY':
    case 'YOUTUBE_AGE_RESTRICTED':
      return {
        title: copy.restrictedTitle,
        tips: [copy.restrictedTip1, copy.restrictedTip2],
      };
    case 'TRANSCRIPTION_FILE_TOO_LARGE':
    case 'YOUTUBE_AUDIO_TOO_LONG':
      return {
        title: copy.tooLongTitle,
        tips: [copy.tooLongTip1, copy.tooLongTip2],
      };
    default:
      return {
        title: copy.title,
        tips: [copy.youtubeTip1, copy.youtubeTip2, copy.youtubeTip3],
      };
  }
}
