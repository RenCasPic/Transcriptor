import type { Json } from '@/lib/types/database';

export interface HeadingItem {
  level: 2 | 3;
  text: string;
  /** Posición ordinal entre TODOS los h2/h3 del documento (para el scroll). */
  ordinal: number;
}

/**
 * Encabezados (h2/h3) del documento del editor, en orden. Se comparte entre la
 * regla de navegación (`EditorScale`) y la estructura de la consola para que
 * ambos usen la MISMA numeración editorial.
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

export interface ChapterSpan {
  /** Número de capítulo, 1-indexado (solo cuenta h2). */
  index: number;
  /** Ordinal del encabezado entre todos los h2/h3 (para `jumpToHeading`). */
  ordinal: number;
  text: string;
  /** Palabras que contiene el capítulo (desde su h2 hasta el siguiente h2). */
  words: number;
}

/** Longitud de cada capítulo (h2) en palabras — la "regla" de la izquierda. */
export function chapterSpans(json: Json): ChapterSpan[] {
  const doc = json as {
    content?: Array<{ type?: string; attrs?: { level?: number }; content?: unknown }>;
  };
  const nodes = Array.isArray(doc?.content) ? doc.content : [];

  const spans: ChapterSpan[] = [];
  let ordinal = 0;
  let current: ChapterSpan | null = null;

  for (const node of nodes) {
    const isChapter = node.type === 'heading' && (node.attrs?.level ?? 2) === 2;
    if (isChapter) {
      const text = collectText(node).trim();
      current = { index: spans.length + 1, ordinal, text, words: 0 };
      spans.push(current);
    } else if (current) {
      current.words += countWords(collectText(node));
    }
    if (node.type === 'heading') ordinal += 1;
  }
  return spans;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectText(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) return node.content.map(collectText).join(' ');
  return '';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Hace scroll (y "barre" la cabeza de registro) al encabezado n-ésimo. */
export function jumpToHeading(ordinal: number): void {
  const headings = document.querySelectorAll<HTMLElement>('.tiptap-editor h2, .tiptap-editor h3');
  const el = headings[ordinal];
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('outline-flash');
  window.setTimeout(() => el.classList.remove('outline-flash'), 1600);
}
