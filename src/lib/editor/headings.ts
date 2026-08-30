import type { Json } from '@/lib/types/database';

export interface HeadingItem {
  level: 2 | 3;
  text: string;
  /** Posición ordinal entre TODOS los h2/h3 del documento (para el scroll). */
  ordinal: number;
}

/**
 * Encabezados (h2/h3) del documento del editor, en orden. Se comparte entre el
 * folio (`EditorSpine`) y la estructura de la sala de control para que ambos
 * usen la MISMA numeración editorial.
 */
export function extractHeadings(json: Json): HeadingItem[] {
  const doc = json as {
    content?: Array<{ type?: string; attrs?: { level?: number }; content?: Array<{ text?: string }> }>;
  };
  if (!Array.isArray(doc?.content)) return [];

  const items: HeadingItem[] = [];
  let ordinal = 0;
  for (const node of doc.content) {
    if (node.type !== 'heading') continue;
    const level = node.attrs?.level === 3 ? 3 : 2;
    const text = (node.content ?? [])
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    if (text) items.push({ level, text, ordinal });
    ordinal += 1;
  }
  return items;
}

/** Hace scroll (y destella) al encabezado n-ésimo dentro de `.tiptap-editor`. */
export function jumpToHeading(ordinal: number): void {
  const headings = document.querySelectorAll<HTMLElement>('.tiptap-editor h2, .tiptap-editor h3');
  const el = headings[ordinal];
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('outline-flash');
  window.setTimeout(() => el.classList.remove('outline-flash'), 1400);
}
