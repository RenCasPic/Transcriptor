/**
 * Traducciones de los códigos de error del import de YouTube a mensajes en
 * español. Viven en su propio módulo (sin `'use server'`) porque Next.js
 * exige que TODO lo exportado de un archivo `'use server'` sea una función
 * async — estas son funciones puras y síncronas, así que no pueden vivir en
 * `youtube.ts` junto a las Server Actions.
 */

export function translateImportError(message: string): string {
  if (message === 'NO_CAPTIONS') {
    return 'Este video no tiene subtítulos disponibles. Prueba con otro video o sube el archivo manualmente.';
  }
  if (message === 'EMPTY_TRANSCRIPT' || message === 'TRANSCRIPT_FETCH_PARSE_ERROR') {
    return 'No se pudo extraer contenido de los subtítulos de ese video.';
  }
  if (message.startsWith('YOUTUBE_PAGE_FETCH_ERROR') || message.startsWith('YOUTUBE_TRANSCRIPT_FETCH_ERROR')) {
    return 'No se pudo acceder a ese video de YouTube. Verifica que sea público e inténtalo de nuevo.';
  }
  return `No se pudo importar el video. Inténtalo de nuevo. (${message})`;
}

export function translateAudioFallbackError(message: string, maxDurationSeconds: number): string {
  const maxMinutes = Math.round(maxDurationSeconds / 60);

  if (message === 'YOUTUBE_PRIVATE_VIDEO') {
    return 'Este video es privado y no se puede transcribir automáticamente.';
  }
  if (message === 'YOUTUBE_VIDEO_NOT_FOUND') {
    return 'No se encontró ese video. Puede haber sido eliminado o la URL ser incorrecta.';
  }
  if (message === 'YOUTUBE_AGE_RESTRICTED') {
    return 'Este video tiene restricción de edad y no se puede procesar automáticamente.';
  }
  if (message === 'YOUTUBE_REGION_BLOCKED') {
    return 'Este video no está disponible en la región de nuestro servidor.';
  }
  if (message === 'YOUTUBE_LIVE_UNSUPPORTED') {
    return 'No se pueden transcribir transmisiones en vivo.';
  }
  if (message === 'YOUTUBE_AUDIO_FORMAT_UNSUPPORTED') {
    return 'El formato de audio de este video no es compatible con la transcripción automática.';
  }
  if (message === 'YOUTUBE_AUDIO_TOO_LONG') {
    return `Este video supera el límite de ${maxMinutes} minutos para la transcripción automática de audio.`;
  }
  if (message === 'TRANSCRIPTION_FILE_TOO_LARGE') {
    return 'El audio extraído supera el límite de 25 MB permitido.';
  }
  if (message === 'YOUTUBE_AUDIO_DOWNLOAD_TIMEOUT' || message === 'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT') {
    return 'La extracción del audio tardó demasiado. Inténtalo de nuevo.';
  }
  if (message === 'YOUTUBE_AUDIO_DOWNLOAD_FAILED') {
    return 'No se pudo descargar el audio de ese video. Inténtalo de nuevo más tarde.';
  }
  if (message.startsWith('YOUTUBE_AUDIO_EXTRACTION_FAILED')) {
    const detail = message.slice('YOUTUBE_AUDIO_EXTRACTION_FAILED:'.length);
    return `No se pudo descargar el audio de ese video. Inténtalo de nuevo más tarde. (${detail})`;
  }
  if (message === 'EMPTY_TRANSCRIPT') {
    return 'No se detectó voz en el audio extraído del video.';
  }
  if (message.startsWith('TRANSCRIPTION_PROVIDER_HTTP_ERROR:429')) {
    return 'Se alcanzó el límite de uso del servicio de transcripción. Inténtalo de nuevo en unos minutos.';
  }
  if (message.startsWith('TRANSCRIPTION_PROVIDER_HTTP_ERROR')) {
    return 'El servicio de transcripción no pudo procesar el audio. Inténtalo de nuevo.';
  }
  return `No se pudo transcribir el audio de ese video. Inténtalo de nuevo. (${message})`;
}
