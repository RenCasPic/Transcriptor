'use client';

import { Check, Loader2, AlertTriangle } from 'lucide-react';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const STYLE: Record<AutosaveStatus, string> = {
  idle: 'text-muted-foreground',
  dirty: 'text-warning',
  saving: 'text-muted-foreground',
  saved: 'text-success',
  error: 'text-destructive',
  conflict: 'text-destructive',
};

function StatusIcon({ status }: { status: AutosaveStatus }) {
  if (status === 'saving') return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === 'saved') return <Check className="h-3.5 w-3.5" />;
  if (status === 'error' || status === 'conflict') return <AlertTriangle className="h-3.5 w-3.5" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-current" />;
}

export function SaveStatusIndicator({ status, iconOnly = false }: { status: AutosaveStatus; iconOnly?: boolean }) {
  const t = useDictionary();
  const label = t.editor.saveStatus[status];

  if (iconOnly) {
    return (
      <span className={cn('inline-flex items-center', STYLE[status])} title={label} aria-label={label}>
        <StatusIcon status={status} />
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', STYLE[status])}>
      <StatusIcon status={status} />
      {label}
    </span>
  );
}
