/**
 * Configuración central de idiomas de la interfaz (i18n). Para agregar un
 * idioma nuevo en el futuro:
 *   1. Agrega su código a LOCALES y su nombre a LOCALE_LABELS.
 *   2. Crea `src/lib/i18n/dictionaries/<codigo>.ts` exportando un objeto con
 *      exactamente la misma forma que `dictionaries/es.ts` (TypeScript marca
 *      error si falta alguna clave, gracias al tipo `Dictionary`).
 *   3. Regístralo en `src/lib/i18n/dictionaries/index.ts`.
 * No requiere cambiar rutas ni el resto de la app.
 */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

export const LOCALE_COOKIE_NAME = 'locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
