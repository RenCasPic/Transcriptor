import { Loader2, Check, AlertTriangle, CircleDashed } from 'lucide-react';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import { cn } from '@/lib/utils';

const CONFIG: Record<AutosaveStatus, { label: string; icon: typeof Check; className: string }> = {
  idle: { label: 'Sin cambios', icon: CircleDashed, className: 'text-muted-foreground' },
  saving: { label: 'Guardando...', icon: Loader2, className: 'text-muted-foreground' },
  saved: { label: 'Guardado', icon: Check, className: 'text-success' },
  error: { label: 'Error al guardar', icon: AlertTriangle, className: 'text-destructive' },
  conflict: { label: 'Conflicto: recarga la página', icon: AlertTriangle, className: 'text-destructive' },
};

export function SaveStatusIndicator({ status }: { status: AutosaveStatus }) {
  const config = CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-medium', config.className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} />
      {config.label}
    </div>
  );
}
