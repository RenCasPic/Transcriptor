import type { Json } from '@/lib/types/database';

export interface InlineImageInsert {
  /** `attrs.blockId` del bloque (el H2 de la sección) después del cual va la imagen. */
  afterBlockId: string;
  src: string;
  alt: string;
  /** Descripción con la que se generó (se conserva para poder regenerarla). */
  prompt?: string | null;
}

export interface InsertImagesResult {
  doc: Json;
  inserted: number;
  /** `afterBlockId` que no se encontraron en el documento (esas imágenes no se insertan). */
  missing: string[];
}

type PmNode = { type?: string; attrs?: Record<string, unknown>; content?: unknown[] } & Record<string, unknown>;

/** Nodo `image` de TipTap/ProseMirror. */
export function imageNode(image: { src: string; alt: string; prompt?: string | null; imageId?: string }): Json {
  return {
    type: 'image',
    // `imageId` identifica la imagen para contar sus regeneraciones desde el editor.
    attrs: {
      src: image.src,
      alt: image.alt,
      title: null,
      prompt: image.prompt ?? null,
      imageId: image.imageId ?? crypto.randomUUID(),
    },
  } as Json;
}

/**
 * Inserta nodos `image` justo DESPUÉS del bloque con el `blockId` indicado
 * (normalmente el H2 de su sección). No muta el documento original. Las
 * imágenes cuyo bloque no existe se devuelven en `missing` sin tocar nada: la
 * generación del artículo nunca debe fallar por culpa de una imagen.
 */
export function insertImagesIntoContent(doc: Json, images: InlineImageInsert[]): InsertImagesResult {
  const root = doc as unknown as { content?: PmNode[] } | null;
  const blocks = Array.isArray(root?.content) ? root!.content! : null;
  if (!blocks || images.length === 0) return { doc, inserted: 0, missing: images.map((i) => i.afterBlockId) };

  const byBlock = new Map<string, InlineImageInsert[]>();
  for (const image of images) {
    const list = byBlock.get(image.afterBlockId) ?? [];
    list.push(image);
    byBlock.set(image.afterBlockId, list);
  }

  const next: unknown[] = [];
  const found = new Set<string>();
  for (const block of blocks) {
    next.push(block);
    const id = block.attrs?.blockId;
    if (typeof id === 'string' && byBlock.has(id) && !found.has(id)) {
      found.add(id);
      for (const image of byBlock.get(id)!) next.push(imageNode(image));
    }
  }

  const missing = [...byBlock.keys()].filter((id) => !found.has(id));
  const inserted = images.filter((i) => found.has(i.afterBlockId)).length;
  return { doc: { ...(doc as object), content: next } as Json, inserted, missing };
}
