/**
 * Traducción de los códigos de error del flujo de medios (subida directa +
 * transcripción asíncrona + troceado) a un mensaje de respaldo en español.
 * Vive en su propio módulo sin `'use server'` (funciones puras y síncronas),
 * igual que `youtube-errors.ts`.
 *
 * El mensaje localizado que ve el usuario lo resuelve la UI a partir del
 * CÓDIGO (`t.projects.source.mediaErrors[code]`, en es/en); esta función solo
 * da el texto de respaldo que acompaña al código para logs y para consumidores
 * que no son la UI.
 */

export const MEDIA_ERROR_CODES = [
  'UNSUPPORTED_MEDIA_FORMAT',
  'MEDIA_FILE_TOO_LARGE',
  'MEDIA_SOURCE_TOO_LARGE',
  'AUDIO_EXTRACTION_CLIENT_FAILED',
  'INVALID_MEDIA_FILE',
  'MEDIA_UPLOAD_URL_FAILED',
  'MEDIA_UPLOAD_FAILED',
  'MEDIA_OBJECT_NOT_FOUND',
  'MEDIA_ACCESS_FAILED',
  'MEDIA_SOURCE_NOT_FOUND',
  'AUDIO_EXTRACTION_FAILED',
  'MEDIA_REQUIRES_CHUNKING_UNAVAILABLE',
  'CHUNK_TOO_LARGE',
  'MEDIA_DURATION_EXCEEDED',
  'TRANSCRIPTION_PROVIDER_ERROR',
  'TRANSCRIPTION_NOT_CONFIGURED',
  'AI_NOT_CONFIGURED',
  'AI_RATE_LIMITED',
  'AI_REQUEST_TOO_LARGE',
  'AI_MODEL_UNAVAILABLE',
  'EMPTY_TRANSCRIPT',
  'JOB_FAILED',
  'GENERATION_FAILED',
  'RATE_LIMITED',
  'UNSAFE_URL',
  'UNSUPPORTED_CONTENT_TYPE',
] as const;

export type MediaErrorCode = (typeof MEDIA_ERROR_CODES)[number];

/** Devuelve solo el código, sin el `:detalle` que algunos errores llevan pegado. */
export function extractMediaErrorCode(message: string): string {
  const head = message.split(':')[0] ?? message;
  if (head.startsWith('TRANSCRIPTION_PROVIDER_HTTP_ERROR')) return 'TRANSCRIPTION_PROVIDER_ERROR';
  return head;
}

export interface MediaErrorContext {
  maxUploadMb: number;
  maxDurationMinutes: number;
}

export function translateMediaError(message: string, ctx: MediaErrorContext): string {
  const code = extractMediaErrorCode(message);
  switch (code) {
    case 'UNSUPPORTED_MEDIA_FORMAT':
      return 'Formato de archivo no soportado.';
    case 'MEDIA_FILE_TOO_LARGE':
      return `El archivo supera el tamaño máximo permitido (${ctx.maxUploadMb} MB).`;
    case 'MEDIA_SOURCE_TOO_LARGE':
      return 'El archivo es demasiado grande para procesarlo en el navegador. Prueba con uno más corto.';
    case 'AUDIO_EXTRACTION_CLIENT_FAILED':
      return 'No se pudo extraer el audio del archivo en el navegador. Prueba con otro formato.';
    case 'INVALID_MEDIA_FILE':
      return 'El archivo no es válido.';
    case 'MEDIA_UPLOAD_URL_FAILED':
      return 'No se pudo preparar la subida del archivo. Inténtalo de nuevo.';
    case 'MEDIA_UPLOAD_FAILED':
      return 'No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.';
    case 'MEDIA_OBJECT_NOT_FOUND':
      return 'No se encontró el archivo subido. Vuelve a intentar la subida.';
    case 'MEDIA_ACCESS_FAILED':
      return 'No se pudo acceder al archivo para procesarlo. Inténtalo de nuevo.';
    case 'MEDIA_SOURCE_NOT_FOUND':
      return 'No se encontró el archivo original de esta transcripción.';
    case 'AUDIO_EXTRACTION_FAILED':
      return 'No se pudo extraer el audio del archivo. Verifica que tenga una pista de audio válida.';
    case 'MEDIA_REQUIRES_CHUNKING_UNAVAILABLE':
      return 'Este archivo necesita dividirse para transcribirse, pero el servidor no tiene esa capacidad disponible ahora mismo.';
    case 'CHUNK_TOO_LARGE':
      return 'Un fragmento del audio superó el límite del servicio de transcripción. Inténtalo con un bitrate de chunk menor.';
    case 'MEDIA_DURATION_EXCEEDED':
      return `El archivo supera la duración máxima permitida (${ctx.maxDurationMinutes} minutos).`;
    case 'TRANSCRIPTION_PROVIDER_ERROR':
      return 'El servicio de transcripción no pudo procesar el audio. Inténtalo de nuevo en unos minutos.';
    case 'TRANSCRIPTION_NOT_CONFIGURED':
      return 'Falta configurar la API key de transcripción (TRANSCRIPTION_API_KEY o GROQ_API_KEY).';
    case 'AI_NOT_CONFIGURED':
      return 'Falta configurar la API key de IA (AI_API_KEY o GROQ_API_KEY) para generar el artículo.';
    case 'AI_RATE_LIMITED':
      return 'Se alcanzó el límite de peticiones del proveedor de IA. La transcripción se guardó: espera un minuto y pulsa "Generar artículo".';
    case 'AI_REQUEST_TOO_LARGE':
      return 'La transcripción es demasiado larga para el plan GRATUITO de Groq. La transcripción se guardó. Activa el Dev Tier de Groq (gratis) o usa AI_PROVIDER=anthropic|openai, y pulsa "Generar artículo".';
    case 'AI_MODEL_UNAVAILABLE':
      return 'El modelo de IA configurado no existe o no está disponible para tu cuenta. Revisa AI_MODEL.';
    case 'EMPTY_TRANSCRIPT':
      return 'No se detectó voz en el archivo. Verifica que tenga audio.';
    case 'JOB_FAILED':
      return 'El procesamiento del archivo falló. Inténtalo de nuevo.';
    case 'GENERATION_FAILED':
      return 'La transcripción se guardó, pero la generación del artículo falló. Puedes reintentarla desde el proyecto.';
    case 'RATE_LIMITED':
      return 'Alcanzaste el límite de transcripciones. Inténtalo de nuevo más tarde.';
    case 'UNSAFE_URL':
      return 'Esa URL no es válida o no está permitida.';
    case 'UNSUPPORTED_CONTENT_TYPE':
      return 'La URL no apunta directamente a un archivo de audio/video soportado.';
    default:
      return `No se pudo procesar el archivo. Inténtalo de nuevo. (${message.slice(0, 120)})`;
  }
}
