'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { extractHeadings, jumpToHeading } from '@/lib/editor/headings';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { Json } from '@/lib/types/database';

/**
 * EL FOLIO — la firma visual de la sala de edición.
 *
 * Columna vertical fija a la izquierda que numera cada capítulo (h2) del
 * documento como los folios de un pliego de imprenta, con una "marca del
 * compositor" (playhead) que sigue tu posición de lectura y sirve de
 * navegación. La MISMA numeración reaparece en la estructura de la sala de
 * control: es la capa que conecta el contenido con los controles.
 */
export function EditorSpine({ json }: { json: Json }) {
  const t = useDictionary();
  const chapters = useMemo(() => extractHeadings(json).filter((h) => h.level === 2), [json]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    function measure() {
      ticking.current = false;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.tiptap-editor h2'));
      const marker = window.innerHeight * 0.28;
      let current = 0;
      nodes.forEach((n, i) => {
        if (n.getBoundingClientRect().top <= marker) current = i;
      });
      setActive(current);

      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    }
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [chapters.length]);

  if (chapters.length === 0) return <div aria-hidden className="hidden lg:block" />;

  return (
    <nav
      aria-label={t.editor.spine.label}
      className="sticky top-12 hidden h-[calc(100vh-3rem)] select-none flex-col justify-between py-8 pl-1 pr-3 lg:flex"
    >
      <span className="ed-label rotate-180 [writing-mode:vertical-rl]">{t.editor.spine.label}</span>

      <ol className="relative flex flex-1 flex-col justify-evenly py-6">
        {/* Riel + relleno de progreso */}
        <span aria-hidden className="absolute left-[1.35rem] top-0 h-full w-px bg-[hsl(var(--ed-rule))]" />
        <span
          aria-hidden
          className="absolute left-[1.35rem] top-0 w-px bg-[hsl(var(--ed-accent))] transition-[height] duration-300"
          style={{ height: `${progress * 100}%` }}
        />

        {chapters.map((ch, i) => {
          const isActive = i === active;
          return (
            <li key={`${ch.ordinal}-${ch.text}`} className="group relative flex items-center">
              <button
                type="button"
                onClick={() => jumpToHeading(ch.ordinal)}
                className="flex items-center gap-3 outline-none"
                title={ch.text}
              >
                <span
                  className={cn(
                    'relative z-10 grid h-8 w-11 place-items-center bg-[hsl(var(--ed-paper))] font-mono text-lg tabular-nums transition-all duration-200',
                    isActive
                      ? 'scale-110 text-[hsl(var(--ed-accent))]'
                      : 'text-[hsl(var(--ed-ink-faint))] group-hover:text-[hsl(var(--ed-ink))]',
                  )}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {isActive && (
                  <span aria-hidden className="ed-playhead-pulse -ml-1 text-[hsl(var(--ed-accent))]">
                    ▸
                  </span>
                )}
                {/* Título revelado al pasar el cursor (navegación "magnética"). */}
                <span
                  className={cn(
                    'pointer-events-none absolute left-14 z-20 max-w-[16rem] truncate whitespace-nowrap border border-[hsl(var(--ed-rule))] bg-[hsl(var(--ed-paper))] px-2 py-1 font-mono text-[0.7rem] uppercase tracking-wide text-[hsl(var(--ed-ink))] opacity-0 shadow-[0_1px_0_hsl(var(--ed-rule))] transition-opacity duration-150 group-hover:opacity-100',
                  )}
                >
                  {ch.text}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <span className="ed-label rotate-180 tabular-nums [writing-mode:vertical-rl]">
        {String(active + 1).padStart(2, '0')} — {String(chapters.length).padStart(2, '0')}
      </span>
    </nav>
  );
}
