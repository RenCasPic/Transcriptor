import { postWithRetry } from '@/lib/ai/providers/generic-provider';
import { getImageConfig, resolveImageApiKey } from './config';

export type ImageErrorCode =
  | 'NOT_CONFIGURED'
  | 'INSUFFICIENT_CREDITS'
  | 'CONTENT_REJECTED'
  | 'RATE_LIMITED'
  | 'VERIFICATION_REQUIRED'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'FAILED';

/** Error de generación de imagen con un código estable (nunca incluye la API key). */
export class ImageGenerationError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = 'ImageGenerationError';
    this.code = code;
  }
}

export interface GeneratedImageFile {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
}

const MODERATION_HINTS = /moderation_blocked|content_policy_violation|safety system|rejected by the safety/i;
const QUOTA_HINTS = /insufficient_quota|billing_hard_limit|exceeded your current quota|credit balance/i;
const VERIFY_HINTS = /must be verified|organization verification|verify organization/i;

/** Traduce la respuesta HTTP de error de OpenAI a un `ImageErrorCode`. */
export function classifyImageHttpError(status: number, body: string): ImageErrorCode {
  if (MODERATION_HINTS.test(body)) return 'CONTENT_REJECTED';
  if (status === 402 || QUOTA_HINTS.test(body)) return 'INSUFFICIENT_CREDITS';
  if (VERIFY_HINTS.test(body)) return 'VERIFICATION_REQUIRED';
  if (status === 401 || status === 403) return 'NOT_CONFIGURED';
  if (status === 429) return 'RATE_LIMITED';
  return 'FAILED';
}

const REQUEST_TIMEOUT_MS = 120_000;

interface GenerateImageOptions {
  /** Tiempo máximo de la petición (ms). */
  timeoutMs?: number;
  /** Inyectable para tests. */
  fetchImpl?: typeof postWithRetry;
}

/**
 * Genera UNA imagen con la API de imágenes de OpenAI (`/v1/images/generations`)
 * y devuelve sus bytes. Formato WebP comprimido para que pese poco (el modelo
 * devuelve siempre base64). Lanza `ImageGenerationError`.
 */
export async function generateImage(prompt: string, options: GenerateImageOptions = {}): Promise<GeneratedImageFile> {
  const apiKey = resolveImageApiKey();
  if (!apiKey) throw new ImageGenerationError('NOT_CONFIGURED');

  const { model, quality, size } = getImageConfig();
  const post = options.fetchImpl ?? postWithRetry;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const send = async (extra: Record<string, unknown>): Promise<Response> => {
    try {
      return await post('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt, size, quality, n: 1, ...extra }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new ImageGenerationError(timedOut ? 'TIMEOUT' : 'FAILED');
    }
  };

  let response = await send({ output_format: 'webp', output_compression: 85 });

  // Si el modelo no admite el formato/compresión pedidos, se reintenta con los valores por defecto (PNG).
  if (response.status === 400) {
    const body = await response
      .clone()
      .text()
      .catch(() => '');
    if (/output_format|output_compression|unknown_parameter/i.test(body) && !MODERATION_HINTS.test(body)) {
      response = await send({});
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const code = classifyImageHttpError(response.status, body);
    // El detalle (sin la clave) queda en los logs del servidor, nunca en la UI.
    console.error('[images] OpenAI devolvió un error:', response.status, body.slice(0, 300));
    throw new ImageGenerationError(code, String(response.status));
  }

  const data = (await response.json().catch(() => null)) as { data?: Array<{ b64_json?: string }> } | null;
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new ImageGenerationError('INVALID_RESPONSE');

  return sniffImageType(Uint8Array.from(Buffer.from(b64, 'base64')));
}

/** Detecta el formato real por los primeros bytes (PNG / JPEG / WebP). */
export function sniffImageType(bytes: Uint8Array): GeneratedImageFile {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57;
  if (isWebp) return { bytes, mimeType: 'image/webp', extension: 'webp' };
  if (isJpeg) return { bytes, mimeType: 'image/jpeg', extension: 'jpg' };
  if (isPng) return { bytes, mimeType: 'image/png', extension: 'png' };
  throw new ImageGenerationError('INVALID_RESPONSE', 'formato desconocido');
}

/** Mensaje en español (respaldo; la UI usa su diccionario por código). */
export function imageErrorMessageEs(code: ImageErrorCode): string {
  switch (code) {
    case 'NOT_CONFIGURED':
      return 'La generación de imágenes no está configurada (falta AI_API_KEY de OpenAI).';
    case 'INSUFFICIENT_CREDITS':
      return 'Tu cuenta de OpenAI no tiene créditos suficientes para generar imágenes.';
    case 'CONTENT_REJECTED':
      return 'OpenAI rechazó la descripción de la imagen por su política de contenido. Modifícala e inténtalo de nuevo.';
    case 'RATE_LIMITED':
      return 'OpenAI está limitando las solicitudes. Espera un momento e inténtalo de nuevo.';
    case 'VERIFICATION_REQUIRED':
      return 'OpenAI requiere verificar tu organización para usar este modelo de imágenes.';
    case 'TIMEOUT':
      return 'La imagen tardó demasiado en generarse. Inténtalo de nuevo.';
    default:
      return 'No se pudo generar la imagen. Inténtalo de nuevo.';
  }
}
