import { UPLOAD_ALLOWED_MIME_TYPES } from './storage';

/** Valor del atributo `accept` de los `<input type="file">` de imágenes (JPG, PNG, WebP). */
export const MEDIA_UPLOAD_ACCEPT = (UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).join(',');
