/** Clave de la portada en el contador de regeneraciones (las demás imágenes usan su `imageId`). */
export const COVER_IMAGE_KEY = 'cover';

const DEFAULT_MAX_REGENERATIONS = 3;

/**
 * Máximo de generaciones con IA por imagen desde el editor ("Regenerar" y
 * "Generar otra"), configurable con `AI_IMAGE_MAX_REGENERATIONS`. Solo servidor.
 */
export function getMaxRegenerationsPerImage(env: Record<string, string | undefined> = process.env): number {
  const value = Number.parseInt(env.AI_IMAGE_MAX_REGENERATIONS ?? '', 10);
  return Number.isInteger(value) && value >= 1 && value <= 50 ? value : DEFAULT_MAX_REGENERATIONS;
}

/** Cuántas generaciones quedan, sin bajar de 0. */
export function remainingRegenerations(used: number, max: number): number {
  return Math.max(0, max - Math.max(0, used));
}

/**
 * Errores de Postgres/PostgREST que indican que la migración 0023 aún no está
 * aplicada (tabla o función inexistente): en ese caso el límite no se aplica en
 * vez de bloquear la generación de imágenes.
 */
export function isMissingRegenerationSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '') ||
    /document_image_regenerations|use_image_regeneration|release_image_regeneration/i.test(error.message ?? '')
  );
}
