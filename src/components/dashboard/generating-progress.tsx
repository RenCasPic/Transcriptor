'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

/** Tiempo característico (ms) con el que la barra se acerca a su tope. */
const EASE_MS = 25_000;
const MAX_PCT = 92;

/**
 * Tarjeta "Generando artículo..." con barra de progreso para el flujo de pegar
 * un enlace. Ese flujo corre en el cliente sin un porcentaje real, así que la
 * barra es una ESTIMACIÓN: avanza rápido al inicio y se frena cerca del 92 %
 * hasta que la página navega al editor.
 */
export function GeneratingProgress({ label }: { label: string }) {
  const [pct, setPct] = useState(3);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setPct(Math.max(3, MAX_PCT * (1 - Math.exp(-elapsed / EASE_MS))));
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span>{label}</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
