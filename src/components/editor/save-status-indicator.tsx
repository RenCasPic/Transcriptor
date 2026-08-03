'use client';

import { Loader2, Check, AlertTriangle, CircleDashed } from 'lucide-react';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const ICONS: Record<AutosaveStatus, { icon: typeof Check; className: string }> = {
  idle: { icon: CircleDashed, className: 'text-muted-foreground' },
  saving: { icon: Loader2, className: 'text-muted-foreground' },
  saved: { icon: Check, className: 'text-success' },
  error: { icon: AlertTriangle, className: 'text-destructive' },
  conflict: { icon: AlertTriangle, className: 'text-destructive' },
};

export function SaveStatusIndicator({ status }: { status: AutosaveStatus }) {
  const t = useDictionary();
  const { icon: Icon, className } = ICONS[status];

  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-medium', className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} />
      {t.editor.saveStatus[status]}
    </div>
  );
}
