'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { extractHeadings, jumpToHeading } from '@/lib/editor/headings';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { Json } from '@/lib/types/database';

/**
 * Índice del artículo: los capítulos (h2) van numerados 01, 02… y los
 * sub-apartados (h3) cuelgan indentados. Al pulsar, salta a la sección y el
 * ítem queda seleccionado (mismo tratamiento visual que un segmento
 * seleccionado en el panel de Transcripción), no solo resaltado al pasar el
 * cursor.
 */
export function ArticleOutline({ json }: { json: Json }) {
  const t = useDictionary();
  const items = useMemo(() => extractHeadings(json), [json]);
  const [selectedOrdinal, setSelectedOrdinal] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <p className="p-4 text-sm leading-relaxed text-muted-foreground">{t.editor.outline.empty}</p>
    );
  }

  let chapter = 0;

  return (
    <nav className="p-2">
      <ol className="space-y-0.5">
        {items.map((item) => {
          const isChapter = item.level === 2;
          if (isChapter) chapter += 1;
          const isSelected = item.ordinal === selectedOrdinal;
          return (
            <li key={`${item.ordinal}-${item.text}`}>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrdinal(item.ordinal);
                  jumpToHeading(item.ordinal);
                }}
                title={item.text}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60',
                  !isChapter && 'pl-7',
                  isSelected && 'border-primary/40 bg-accent',
                )}
              >
                {isChapter && (
                  <span className="mt-px w-5 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {String(chapter).padStart(2, '0')}
                  </span>
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]',
                    isChapter ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {item.text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
