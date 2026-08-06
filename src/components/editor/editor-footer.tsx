'use client';

import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { SaveStatusIndicator } from './save-status-indicator';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';

/**
 * Franja de estado del editor (conteo de palabras + guardado). Vive fuera
 * del contenedor con scroll (ver ArticleEditor) para quedar siempre visible,
 * igual que el título y la barra de herramientas.
 */
export function EditorFooter({ wordCount, status }: { wordCount: number; status: AutosaveStatus }) {
  const t = useDictionary();
  const locale = useLocale();

  return (
    <div className="flex shrink-0 items-center justify-between border-t bg-background px-4 py-1 text-xs text-muted-foreground sm:px-8">
      <div className="flex gap-3">
        <span>
          {wordCount.toLocaleString(locale)} {t.common.words}
        </span>
        <span>
          {estimateReadingTimeMinutes(wordCount)} {t.common.minutesReading}
        </span>
      </div>
      <SaveStatusIndicator status={status} />
    </div>
  );
}
