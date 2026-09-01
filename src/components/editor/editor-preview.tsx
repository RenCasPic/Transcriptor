'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';

/**
 * Vista previa: el artículo tal como lo vería un lector, sin herramientas.
 * Renderiza el HTML actual del editor con el mismo estilo `prose` de la app.
 */
export function EditorPreview({
  title,
  html,
  wordCount,
  coverImageUrl,
  coverImageAlt,
  onClose,
}: {
  title: string;
  html: string;
  wordCount: number;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  onClose: () => void;
}) {
  const t = useDictionary();
  const locale = useLocale();

  return (
    <Card className="mx-auto max-w-3xl overflow-hidden">
      <div className="flex items-center justify-between border-b bg-background/80 px-4 py-2.5 backdrop-blur">
        <span className="text-sm font-medium text-muted-foreground">{t.editor.preview.label}</span>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onClose}>
          <X className="h-4 w-4" />
          {t.editor.preview.exit}
        </Button>
      </div>

      <article className="px-6 py-10 sm:px-10 sm:py-12">
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={coverImageAlt ?? ''}
            className="mb-8 aspect-[16/6] w-full rounded-lg border object-cover"
          />
        )}
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 border-b pb-4 text-xs text-muted-foreground">
          <span className="tabular-nums">{wordCount.toLocaleString(locale)}</span> {t.common.words}
          <span aria-hidden className="mx-2">·</span>
          <span className="tabular-nums">{estimateReadingTimeMinutes(wordCount)}</span>{' '}
          {t.common.minutesReading}
        </p>
        <div className="tiptap-editor mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </Card>
  );
}
