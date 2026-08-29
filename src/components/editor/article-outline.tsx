'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { Json } from '@/lib/types/database';

interface OutlineItem {
  level: 2 | 3;
  text: string;
}

function extractHeadings(json: Json): OutlineItem[] {
  const doc = json as { content?: Array<{ type?: string; attrs?: { level?: number }; content?: Array<{ text?: string }> }> };
  if (!Array.isArray(doc?.content)) return [];
  const items: OutlineItem[] = [];
  for (const node of doc.content) {
    if (node.type !== 'heading') continue;
    const level = node.attrs?.level === 3 ? 3 : 2;
    const text = (node.content ?? []).map((c) => c.text ?? '').join('').trim();
    if (text) items.push({ level, text });
  }
  return items;
}

/**
 * Índice del artículo a partir de los encabezados del editor. Al pulsar un
 * ítem se hace scroll al encabezado correspondiente dentro de `.tiptap-editor`
 * (por posición ordinal, así funciona también para encabezados nuevos que aún
 * no tienen `data-block-id`).
 */
export function ArticleOutline({ json }: { json: Json }) {
  const t = useDictionary();
  const items = useMemo(() => extractHeadings(json), [json]);

  function jumpTo(ordinal: number) {
    const headings = document.querySelectorAll<HTMLElement>('.tiptap-editor h2, .tiptap-editor h3');
    const el = headings[ordinal];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('outline-flash');
    window.setTimeout(() => el.classList.remove('outline-flash'), 1200);
  }

  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t.editor.outline.empty}</p>;
  }

  return (
    <nav className="p-3">
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={`${i}-${item.text}`}>
            <button
              type="button"
              onClick={() => jumpTo(i)}
              className={cn(
                'block w-full truncate rounded-md px-2 py-1.5 text-left text-[15px] leading-6 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                item.level === 3 && 'pl-5 text-sm',
              )}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
