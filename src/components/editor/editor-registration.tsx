'use client';

import { cn } from '@/lib/utils';
import type { EditorScrollInfo } from '@/lib/editor/use-editor-scroll';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

/**
 * LA LÍNEA DE REGISTRO — el mecanismo característico del instrumento.
 *
 * Un filete horizontal que atraviesa el manuscrito a la altura de la "cabeza
 * de lectura", con un cuadro de coordenadas en su extremo derecho:
 *   §NN  ·  NN%  ·  MODO
 * En calma es casi invisible; al desplazarte o editar, se afila.
 */
export function EditorRegistration({
  scroll,
  mode,
  modeLabel,
  saveStatus,
}: {
  scroll: EditorScrollInfo;
  mode: string;
  modeLabel: string;
  saveStatus: AutosaveStatus;
}) {
  const t = useDictionary();
  const section = String(Math.min(scroll.activeIndex + 1, Math.max(1, scroll.count))).padStart(2, '0');
  const pct = Math.round(scroll.progress * 100)
    .toString()
    .padStart(2, '0');
  const dirty = saveStatus === 'dirty' || saveStatus === 'saving';

  return (
    <div
      className="pointer-events-none sticky top-9 z-20 -mx-px h-0"
      data-registration-mode={mode}
      aria-hidden
    >
      <div className="relative border-t border-[hsl(var(--ed-rule))]">
        {/* extremo izquierdo: marca de registro — sólo en inspección/edición */}
        <span
          className={cn(
            'absolute left-3 top-0 -translate-y-1/2 bg-[hsl(var(--ed-paper))] px-1 font-mono text-[0.58rem] text-[hsl(var(--ed-ink-faint))] transition-opacity',
            dirty ? 'opacity-100' : 'opacity-0 group-hover/ms:opacity-100',
          )}
        >
          +
        </span>

        {/* cuadro de coordenadas: en calma sólo muestra el MODO; los chips
            §NN y NN% aparecen al inspeccionar (hover) o al editar. */}
        <div className="absolute right-2 top-0 flex -translate-y-1/2 items-stretch gap-0 border border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[hsl(var(--ed-ink-soft))]">
          <span
            className={cn(
              'px-1.5 py-0.5 tabular-nums',
              dirty ? 'text-[hsl(var(--ed-accent))]' : 'hidden group-hover/ms:block',
            )}
          >
            §{section}
          </span>
          <span
            className={cn(
              'border-l border-[hsl(var(--ed-rule))] px-1.5 py-0.5 tabular-nums',
              !dirty && 'hidden group-hover/ms:block',
            )}
          >
            {pct}%
          </span>
          <span
            className={cn(
              'flex items-center gap-1 bg-[hsl(var(--ed-paper-sunk))] px-1.5 py-0.5 text-[hsl(var(--ed-ink))]',
              dirty
                ? 'border-l border-[hsl(var(--ed-rule))]'
                : 'border-l border-[hsl(var(--ed-rule))] border-l-transparent group-hover/ms:border-l-[hsl(var(--ed-rule))]',
            )}
          >
            <span
              className={cn(
                'inline-block h-1 w-1 rounded-full',
                dirty ? 'ed-blink bg-[hsl(var(--ed-accent))]' : 'bg-[hsl(var(--ed-rule-strong))]',
              )}
            />
            {t.editor.registration.mode} {modeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
