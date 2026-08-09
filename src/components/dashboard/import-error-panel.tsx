'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Panel temporal (descartable) que explica en lenguaje simple qué salió mal
 * y cómo corregirlo, en vez de mandar al usuario a la página de un proyecto
 * "Fallido" que no tiene ningún contenido útil.
 */
export function ImportErrorPanel({
  title,
  message,
  tips,
  dismissLabel,
  onDismiss,
}: {
  title: string;
  message: string;
  tips: string[];
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onDismiss}
        aria-label={dismissLabel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
