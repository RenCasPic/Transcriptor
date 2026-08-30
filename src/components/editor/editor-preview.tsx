'use client';

import { X } from 'lucide-react';
import { estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';

/**
 * Prueba de imprenta: el artículo tal como lo vería un lector, sin folio,
 * sala de control ni herramientas. Renderiza el HTML actual del editor.
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
    <div className="min-h-[calc(100vh-var(--app-header-h)-3rem)] bg-[hsl(var(--ed-paper))]">
      <div className="sticky top-12 z-30 flex h-11 items-center justify-between border-b border-[hsl(var(--ed-rule))] bg-[hsl(var(--ed-paper))]/95 px-5 backdrop-blur">
        <span className="ed-label">{t.editor.preview.label}</span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[hsl(var(--ed-ink-soft))] transition-colors hover:text-[hsl(var(--ed-ink))]"
        >
          <X className="h-3.5 w-3.5" />
          {t.editor.preview.exit}
        </button>
      </div>

      <article className="mx-auto max-w-[42rem] px-6 py-20 sm:px-8">
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={coverImageAlt ?? ''}
            className="mb-10 aspect-[16/6] w-full object-cover grayscale-[0.15]"
          />
        )}
        <p className="ed-label mb-5">{t.editor.masthead.kicker}</p>
        <h1 className="font-display text-[2.7rem] font-medium leading-[1.05] tracking-[-0.02em] text-[hsl(var(--ed-ink))] sm:text-[3.6rem]">
          {title}
        </h1>
        <p className="mt-6 border-y border-[hsl(var(--ed-rule))] py-3 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-[hsl(var(--ed-ink-faint))]">
          <span className="text-[hsl(var(--ed-ink-soft))]">{wordCount.toLocaleString(locale)}</span> {t.common.words}
          <span className="mx-2.5 text-[hsl(var(--ed-rule-strong))]">—</span>
          <span className="text-[hsl(var(--ed-ink-soft))]">{estimateReadingTimeMinutes(wordCount)}</span>{' '}
          {t.common.minutesReading}
        </p>
        <div className="tiptap-editor mt-12" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}
