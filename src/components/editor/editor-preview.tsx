'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';

/**
 * Vista previa de lectura: el artículo tal como lo vería un lector, sin
 * toolbar, panel ni controles de edición. Renderiza el HTML actual del editor
 * (mismo modelo de confianza que el propio editor: es tu contenido local).
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
    <div className="min-h-[calc(100vh-var(--app-header-h))] bg-background">
      <div className="sticky top-0 z-40 flex h-11 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.editor.preview.label}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          {t.editor.preview.exit}
        </Button>
      </div>

      <article className="mx-auto max-w-[44rem] px-5 py-12 sm:px-6">
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={coverImageAlt ?? ''}
            className="mb-8 aspect-[16/7] w-full rounded-xl object-cover"
          />
        )}
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {wordCount.toLocaleString(locale)} {t.common.words} ·{' '}
          {estimateReadingTimeMinutes(wordCount)} {t.common.minutesReading}
        </p>
        <hr className="my-8" />
        <div
          className="prose prose-lg prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
