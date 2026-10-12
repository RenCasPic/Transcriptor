/**
 * Configuración de la generación de imágenes con OpenAI. Solo servidor: la API
 * key (`AI_API_KEY`) nunca debe llegar al navegador ni a los logs.
 */

/** Modelo de imágenes por defecto (vigente a 2026-10); cambiable con AI_IMAGE_MODEL. */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-flare';
export const DEFAULT_IMAGE_QUALITY = 'medium';
export const DEFAULT_IMAGE_SIZE = '1536x1024';

const QUALITIES = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'auto']);
const SIZE_PATTERN = /^(auto|\d{3,4}x\d{3,4})$/;

export interface ImageConfig {
  model: string;
  quality: string;
  size: string;
}

export function getImageConfig(env: Record<string, string | undefined> = process.env): ImageConfig {
  const quality = (env.AI_IMAGE_QUALITY ?? '').trim().toLowerCase();
  const size = (env.AI_IMAGE_SIZE ?? '').trim().toLowerCase();
  return {
    model: (env.AI_IMAGE_MODEL ?? '').trim() || DEFAULT_IMAGE_MODEL,
    quality: QUALITIES.has(quality) ? quality : DEFAULT_IMAGE_QUALITY,
    size: SIZE_PATTERN.test(size) ? size : DEFAULT_IMAGE_SIZE,
  };
}

/**
 * Clave para las imágenes: `AI_API_KEY`, pero solo cuando el proveedor de texto
 * es OpenAI (una clave de Anthropic o Groq no sirve para la API de imágenes).
 */
export function resolveImageApiKey(env: Record<string, string | undefined> = process.env): string | undefined {
  const provider = (env.AI_PROVIDER || 'openai').toLowerCase();
  if (provider !== 'openai') return undefined;
  return env.AI_API_KEY || undefined;
}

export function isImageGenerationConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!resolveImageApiKey(env);
}
