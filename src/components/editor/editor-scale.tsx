'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { chapterSpans, jumpToHeading } from '@/lib/editor/headings';
import { estimateReadingTimeMinutes } from '@/lib/content/metrics';
import type { EditorScrollInfo } from '@/lib/editor/use-editor-scroll';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import type { Json } from '@/lib/types/database';

/**
 * LA REGLA — instrumento de navegación del manuscrito.
 *
 * No es un índice: es una regla de medición. Cada capítulo es una barra cuya
 * longitud es proporcional a su extensión en palabras; un corchete recorre el
 * eje marcando dónde está la "cabeza de registro". Al pasar por encima, emerge
 * la ficha del capítulo. Al pulsar, la cabeza viaja hasta allí.
 */
export function EditorScale({ json, scroll }: { json: Json; scroll: EditorScrollInfo }) {
  const t = useDictionary();
  const locale = useLocale();
  const chapters = useMemo(() => chapterSpans(json), [json]);
  const maxWords = Math.max(1, ...chapters.map((c) => c.words));
  const [hover, setHover] = useState<number | null>(null);
  const active = Math.min(scroll.activeIndex, Math.max(0, chapters.length - 1));
  const progress = scroll.progress;

  if (chapters.length === 0) return <div aria-hidden className="hidden lg:block" />;

  return (
    <nav
      aria-label={t.editor.spine.label}
      className="group/scale sticky top-9 hidden h-[calc(100vh-2.25rem)] select-none flex-col text-[hsl(var(--ed-desk-ink))] lg:flex"
      onMouseLeave={() => setHover(null)}
    >
      <span className="ed-label px-3 pt-7 text-[hsl(var(--ed-desk-ink-dim))]">{t.editor.spine.label}</span>

      <ol className="relative flex flex-1 flex-col justify-evenly py-10">
        {/* Eje de la regla */}
        <span aria-hidden className="absolute bottom-0 left-8 top-0 w-px bg-[hsl(var(--ed-desk-line))]" />
        {/* Corchete de la cabeza de registro (posición de scroll) */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[1.55rem] font-mono text-[hsl(var(--ed-accent))] transition-[top] duration-300 ease-out"
          style={{ top: `calc(${progress * 100}% - 0.5rem)` }}
        >
          ▐
        </span>

        {chapters.map((ch, i) => {
          const isActive = i === active;
          const w = 0.9 + (ch.words / maxWords) * 3.1; // rem
          return (
            <li
              key={`${ch.ordinal}-${ch.text}`}
              className="relative flex items-center pl-3"
              onMouseEnter={() => setHover(i)}
            >
              <button
                type="button"
                onClick={() => jumpToHeading(ch.ordinal)}
                title={ch.text}
                className="flex items-center gap-2.5 outline-none"
              >
                <span
                  className={cn(
                    'w-6 shrink-0 text-right font-mono text-[0.7rem] tabular-nums transition-colors',
                    isActive ? 'text-[hsl(var(--ed-accent))]' : 'text-[hsl(var(--ed-desk-ink-dim))]',
                  )}
                >
                  {String(ch.index).padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    'block h-px shrink-0 origin-left transition-all duration-200',
                    isActive
                      ? 'h-[2px] bg-[hsl(var(--ed-accent))]'
                      : 'bg-[hsl(var(--ed-desk-ink-dim))] group-hover/scale:bg-[hsl(var(--ed-desk-ink))]',
                    hover === i && !isActive && '!bg-[hsl(var(--ed-desk-ink))]',
                  )}
                  style={{ width: `${hover === i ? w + 0.6 : w}rem` }}
                />
              </button>

              {/* Ficha contextual — invade el papel */}
              {hover === i && (
                <div className="ed-mode-sweep absolute left-[calc(100%+0.25rem)] top-1/2 z-30 w-56 -translate-y-1/2 border border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] px-3 py-2.5 text-[hsl(var(--ed-ink))] shadow-[4px_4px_0_hsl(var(--ed-desk-2))]">
                  <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[hsl(var(--ed-ink-faint))]">
                    §{String(ch.index).padStart(2, '0')}
                  </p>
                  <p className="font-display text-[0.98rem] leading-snug">{ch.text}</p>
                  <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[hsl(var(--ed-ink-soft))]">
                    {ch.words.toLocaleString(locale)} {t.common.words}
                    <span className="mx-1.5 text-[hsl(var(--ed-rule-strong))]">·</span>
                    {estimateReadingTimeMinutes(ch.words)} {t.common.minutesReading}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <span className="ed-label px-3 pb-7 tabular-nums text-[hsl(var(--ed-desk-ink-dim))]">
        {String(active + 1).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}
      </span>
    </nav>
  );
}
