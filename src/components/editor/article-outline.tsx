'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { extractHeadings, jumpToHeading } from '@/lib/editor/headings';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { Json } from '@/lib/types/database';

/**
 * ESTRUCTURA — el mapa del documento. Los capítulos (h2) van numerados 01, 02…
 * con la MISMA numeración que el folio de la izquierda; los sub-apartados (h3)
 * cuelgan indentados.
 */
export function ArticleOutline({ json }: { json: Json }) {
  const t = useDictionary();
  const items = useMemo(() => extractHeadings(json), [json]);

  if (items.length === 0) {
    return <p className="px-5 py-6 font-mono text-[0.72rem] leading-relaxed text-[hsl(var(--ed-ink-faint))]">{t.editor.outline.empty}</p>;
  }

  let chapter = 0;

  return (
    <nav className="py-3">
      <ol>
        {items.map((item) => {
          const isChapter = item.level === 2;
          if (isChapter) chapter += 1;
          return (
            <li key={`${item.ordinal}-${item.text}`}>
              <button
                type="button"
                onClick={() => jumpToHeading(item.ordinal)}
                title={item.text}
                className={cn(
                  'flex w-full items-baseline gap-3 border-l-2 border-transparent px-4 py-2 text-left transition-colors hover:border-[hsl(var(--ed-accent))] hover:bg-[hsl(var(--ed-paper-sunk))]',
                  !isChapter && 'pl-10',
                )}
              >
                {isChapter ? (
                  <span className="w-6 shrink-0 font-mono text-[0.72rem] tabular-nums text-[hsl(var(--ed-ink-faint))]">
                    {String(chapter).padStart(2, '0')}
                  </span>
                ) : (
                  <span aria-hidden className="w-6 shrink-0 text-center text-[hsl(var(--ed-rule-strong))]">
                    ·
                  </span>
                )}
                <span
                  className={cn(
                    'truncate',
                    isChapter
                      ? 'font-sans text-[0.95rem] font-medium text-[hsl(var(--ed-ink))]'
                      : 'font-sans text-[0.86rem] text-[hsl(var(--ed-ink-soft))]',
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
