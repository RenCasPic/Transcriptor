/**
 * Fuente única de verdad de los formatos de audio/video aceptados para
 * transcripción. Antes esta tabla estaba duplicada en `upload-video-card`,
 * `content-source-panel` y `transcription.ts` con listas ligeramente
 * distintas; ahora se importa de aquí.
 */

export type MediaSourceType = 'audio' | 'video';

interface MediaFormat {
  extension: string;
  /** Content-Types que el navegador/servidor pueden reportar para este formato. */
  mimeTypes: string[];
  sourceType: MediaSourceType;
}

export const SUPPORTED_MEDIA_FORMATS: MediaFormat[] = [
  { extension: 'mp4', mimeTypes: ['video/mp4'], sourceType: 'video' },
  { extension: 'mov', mimeTypes: ['video/quicktime'], sourceType: 'video' },
  { extension: 'webm', mimeTypes: ['video/webm', 'audio/webm'], sourceType: 'video' },
  { extension: 'mkv', mimeTypes: ['video/x-matroska'], sourceType: 'video' },
  { extension: 'm4v', mimeTypes: ['video/x-m4v', 'video/mp4'], sourceType: 'video' },
  { extension: 'mp3', mimeTypes: ['audio/mpeg', 'audio/mp3'], sourceType: 'audio' },
  { extension: 'wav', mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave'], sourceType: 'audio' },
  { extension: 'm4a', mimeTypes: ['audio/x-m4a', 'audio/mp4', 'audio/m4a'], sourceType: 'audio' },
  { extension: 'aac', mimeTypes: ['audio/aac', 'audio/x-aac'], sourceType: 'audio' },
  { extension: 'ogg', mimeTypes: ['audio/ogg', 'application/ogg'], sourceType: 'audio' },
  { extension: 'flac', mimeTypes: ['audio/flac', 'audio/x-flac'], sourceType: 'audio' },
];

/** Extensiones aceptadas, con punto, para el atributo `accept` de un `<input type=file>`. */
export const MEDIA_ACCEPT_ATTR = SUPPORTED_MEDIA_FORMATS.map((f) => `.${f.extension}`).join(',');

/** Lista legible ("mp4, mov, webm, ...") para textos de UI. */
export const MEDIA_EXTENSIONS_LABEL = SUPPORTED_MEDIA_FORMATS.map((f) => f.extension).join(', ');

/** Todos los MIME types aceptados (para el allowlist del bucket de Storage y validación en servidor). */
export const SUPPORTED_MEDIA_MIME_TYPES = Array.from(
  new Set(SUPPORTED_MEDIA_FORMATS.flatMap((f) => f.mimeTypes)),
);

export function mediaFormatForExtension(extension: string): MediaFormat | undefined {
  const normalized = extension.replace(/^\./, '').toLowerCase();
  return SUPPORTED_MEDIA_FORMATS.find((f) => f.extension === normalized);
}

export function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export interface MediaUploadValidationInput {
  filename: string;
  contentType: string | null;
  sizeBytes: number;
  maxUploadBytes: number;
}

export type MediaUploadValidation =
  | { ok: true; extension: string; sourceType: MediaSourceType }
  | { ok: false; code: 'UNSUPPORTED_MEDIA_FORMAT' | 'MEDIA_FILE_TOO_LARGE' | 'INVALID_MEDIA_FILE' };

/**
 * Validación pura (sin Supabase) de un archivo de medios antes de subirlo o
 * de encolar su transcripción. Se usa tanto en el cliente (feedback rápido)
 * como en el servidor (validación real que no confía en el navegador).
 * El Content-Type es orientativo: los navegadores lo reportan de forma
 * inconsistente para audio/video, así que la extensión manda y el MIME solo
 * se rechaza si contradice claramente a un formato conocido distinto.
 */
export function validateMediaUpload(input: MediaUploadValidationInput): MediaUploadValidation {
  if (!input.filename || !Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, code: 'INVALID_MEDIA_FILE' };
  }

  const extension = extensionOf(input.filename);
  const format = mediaFormatForExtension(extension);
  if (!format) {
    return { ok: false, code: 'UNSUPPORTED_MEDIA_FORMAT' };
  }

  if (input.sizeBytes > input.maxUploadBytes) {
    return { ok: false, code: 'MEDIA_FILE_TOO_LARGE' };
  }

  const contentType = input.contentType?.split(';')[0]?.trim().toLowerCase();
  if (contentType && contentType !== 'application/octet-stream') {
    const matchesSomeKnownFormat = SUPPORTED_MEDIA_FORMATS.some((f) => f.mimeTypes.includes(contentType));
    const matchesThisFormat = format.mimeTypes.includes(contentType);
    // Solo se rechaza si el MIME es de un formato soportado DISTINTO (señal de
    // extensión falseada); un MIME desconocido o genérico se deja pasar.
    if (matchesSomeKnownFormat && !matchesThisFormat) {
      return { ok: false, code: 'UNSUPPORTED_MEDIA_FORMAT' };
    }
  }

  return { ok: true, extension, sourceType: format.sourceType };
}
