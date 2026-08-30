'use client';

import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

// Glifo + color por estado, en clave editorial (sin iconos de "nube").
const GLYPH: Record<AutosaveStatus, { mark: string; className: string; pulse?: boolean }> = {
  idle: { mark: '○', className: 'text-[hsl(var(--ed-ink-faint))]' },
  dirty: { mark: '◍', className: 'text-[hsl(var(--warning))]' },
  saving: { mark: '◐', className: 'text-[hsl(var(--ed-ink-soft))]', pulse: true },
  saved: { mark: '●', className: 'text-[hsl(var(--success))]' },
  error: { mark: '▲', className: 'text-[hsl(var(--destructive))]' },
  conflict: { mark: '▲', className: 'text-[hsl(var(--destructive))]' },
};

export function SaveStatusIndicator({ status, iconOnly = false }: { status: AutosaveStatus; iconOnly?: boolean }) {
  const t = useDictionary();
  const { mark, className, pulse } = GLYPH[status];
  const label = t.editor.saveStatus[status];

  if (iconOnly) {
    return (
      <span
        className={cn('inline-block text-[0.7rem] leading-none', className, pulse && 'animate-pulse')}
        title={label}
        aria-label={label}
      >
        {mark}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.12em]', className)}>
      <span className={cn('text-[0.7rem] leading-none', pulse && 'animate-pulse')}>{mark}</span>
      {label}
    </span>
  );
}
