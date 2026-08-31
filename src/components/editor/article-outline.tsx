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

  const chapterCount = items.filter((i) => i.level === 2).length;

  if (items.length === 0) {
    return (
      <>
        <OutlineHeader title={t.editor.outline.title} count={0} />
        <p className="px-4 py-6 font-mono text-[0.72rem] leading-relaxed text-[hsl(var(--ed-ink-soft))]">
          {t.editor.outline.empty}
        </p>
      </>
    );
  }

  let chapter = 0;

  return (
    <nav>
      <OutlineHeader title={t.editor.outline.title} count={chapterCount} />
      <ol className="py-2">
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
                  'flex w-full items-start gap-2.5 border-l-2 border-transparent py-2 pl-3 pr-3 text-left transition-colors hover:border-[hsl(var(--ed-accent))] hover:bg-[hsl(var(--ed-paper-sunk))]',
                  !isChapter && 'pl-8',
                )}
              >
                {isChapter ? (
                  <span className="mt-[0.15rem] w-5 shrink-0 font-mono text-[0.72rem] tabular-nums text-[hsl(var(--ed-ink-soft))]">
                    {String(chapter).padStart(2, '0')}
                  </span>
                ) : (
                  <span aria-hidden className="mt-[0.1rem] w-5 shrink-0 text-center text-[hsl(var(--ed-rule-strong))]">
                    ·
                  </span>
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 [overflow-wrap:anywhere]',
                    isChapter
                      ? 'font-sans text-[0.95rem] font-medium leading-snug text-[hsl(var(--ed-ink))]'
                      : 'font-sans text-[0.86rem] leading-snug text-[hsl(var(--ed-ink-soft))]',
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

/**
 * Separador entre el selector de estaciones de la consola y el listado del
 * índice: deja claro dónde empieza la navegación del documento.
 */
function OutlineHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] px-4 py-2.5">
      <span className="ed-label text-[hsl(var(--ed-ink-soft))]">{title}</span>
      {count > 0 && (
        <span className="font-mono text-[0.62rem] tabular-nums text-[hsl(var(--ed-ink-faint))]">
          {String(count).padStart(2, '0')}
        </span>
      )}
    </div>
  );
}
