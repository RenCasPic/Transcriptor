import type { Locale } from '@/lib/i18n/config';

const STRINGS: Record<Locale, { initial: string; restoredPrefix: string }> = {
  es: { initial: 'Generación inicial del artículo', restoredPrefix: 'Restaurada desde la versión' },
  en: { initial: 'Initial article generation', restoredPrefix: 'Restored from version' },
};

export function formatVersionReason(reason: string, locale: Locale = 'es'): string {
  const strings = STRINGS[locale];
  if (reason === 'initial_generation') return strings.initial;

  const restoreMatch = reason.match(/^restored_from_version_(\d+)$/);
  if (restoreMatch) return `${strings.restoredPrefix} ${restoreMatch[1]}`;

  return reason;
}
