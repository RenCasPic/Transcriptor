'use client';

import { Fragment, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/config';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { setLocaleAction } from '@/lib/actions/locale';
import { cn } from '@/lib/utils';

/**
 * Interruptor de idioma "ES | EN": se ve de un vistazo y cambia con un solo
 * clic (sin menú). El idioma activo va resaltado; el otro es clicable.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: string) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t.language.switchTo}
      className={cn(
        'inline-flex h-9 items-center rounded-md border border-primary/30 bg-muted/60 p-0.5 text-xs transition-opacity',
        isPending && 'opacity-60',
        className,
      )}
    >
      {LOCALES.map((code, index) => {
        const active = code === locale;
        return (
          <Fragment key={code}>
            {index > 0 && (
              <span aria-hidden className="select-none px-0.5 text-muted-foreground/40">
                |
              </span>
            )}
            <button
              type="button"
              lang={code}
              aria-label={LOCALE_LABELS[code]}
              aria-pressed={active}
              disabled={isPending}
              onClick={() => handleSelect(code)}
              className={cn(
                'inline-flex h-full items-center rounded-[0.3rem] px-2 leading-none sm:px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait',
                active
                  ? 'bg-accent font-bold text-primary'
                  : 'font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {code.toUpperCase()}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
