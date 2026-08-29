'use client';

import { Loader2, Check, AlertTriangle, CloudUpload, Cloud } from 'lucide-react';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const ICONS: Record<AutosaveStatus, { icon: typeof Check; className: string; dot: string }> = {
  idle: { icon: Cloud, className: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  dirty: { icon: CloudUpload, className: 'text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  saving: { icon: Loader2, className: 'text-muted-foreground', dot: 'bg-muted-foreground/60' },
  saved: { icon: Check, className: 'text-emerald-600 dark:text-emerald-500', dot: 'bg-emerald-500' },
  error: { icon: AlertTriangle, className: 'text-destructive', dot: 'bg-destructive' },
  conflict: { icon: AlertTriangle, className: 'text-destructive', dot: 'bg-destructive' },
};

export function SaveStatusIndicator({
  status,
  iconOnly = false,
  onColor = false,
}: {
  status: AutosaveStatus;
  iconOnly?: boolean;
  /** Sobre fondo de color (barra morada): fuerza texto/icono claros. */
  onColor?: boolean;
}) {
  const t = useDictionary();
  const { icon: Icon, className, dot } = ICONS[status];

  if (iconOnly) {
    return (
      <span
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          dot,
          status === 'saving' && 'animate-pulse',
          onColor && (status === 'idle' || status === 'saving') && '!bg-primary-foreground/60',
        )}
        title={t.editor.saveStatus[status]}
        aria-label={t.editor.saveStatus[status]}
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-medium', onColor ? 'text-primary-foreground/90' : className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} />
      {t.editor.saveStatus[status]}
    </div>
  );
}
