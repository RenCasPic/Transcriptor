import type { ImageMode } from '@/lib/types/database';

/** Máximo de imágenes dentro del artículo (sin contar la portada). */
export const MAX_INLINE_IMAGES = 4;

/**
 * Costo APROXIMADO por imagen (USD) con la calidad "medium" y 1536x1024 por
 * defecto. Es solo una referencia para mostrar en la UI: el costo real depende
 * del modelo, la calidad y el tamaño que configures (AI_IMAGE_*) y de la tarifa
 * vigente de OpenAI.
 */
export const APPROX_IMAGE_COST_USD = 0.04;

/** Cuántas imágenes (como máximo) genera cada opción. */
export function maxImagesForMode(mode: ImageMode): number {
  if (mode === 'none') return 0;
  if (mode === 'cover') return 1;
  return 1 + MAX_INLINE_IMAGES;
}

/** Costo aproximado máximo (USD) de la opción elegida. */
export function approxImagesCostUsd(mode: ImageMode): number {
  return Math.round(maxImagesForMode(mode) * APPROX_IMAGE_COST_USD * 100) / 100;
}
