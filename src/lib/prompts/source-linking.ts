/**
 * Prompt para el paso de relación entre bloques del artículo y segmentos de
 * la transcripción fuente (usado cuando el proveedor no devuelve
 * sourceSegmentIds directamente junto con el artículo).
 */
export function buildSourceLinkingPrompt(
  blocks: Array<{ id: string; text: string }>,
  segments: Array<{ index: number; text: string }>,
): string {
  return `Relaciona cada bloque del artículo con los segmentos de la transcripción que lo respaldan.

Devuelve, para cada blockId, la lista de índices de segmento (sourceSegmentIds) más relevantes.
Si un bloque no tiene respaldo claro en ningún segmento, devuelve una lista vacía para ese bloque.

Bloques del artículo:
${blocks.map((b) => `[${b.id}] ${b.text}`).join('\n')}

Segmentos de la transcripción:
${segments.map((s) => `[${s.index}] ${s.text}`).join('\n')}`;
}
