'use client';

import { createContext, useContext, useMemo } from 'react';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';

interface DictionaryContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const DictionaryContext = createContext<DictionaryContextValue | null>(null);

export function DictionaryProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, dictionary }), [locale, dictionary]);
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

export function useDictionary(): Dictionary {
  const ctx = useContext(DictionaryContext);
  if (!ctx) {
    throw new Error('useDictionary debe usarse dentro de <DictionaryProvider>');
  }
  return ctx.dictionary;
}

export function useLocale(): Locale {
  const ctx = useContext(DictionaryContext);
  if (!ctx) {
    throw new Error('useLocale debe usarse dentro de <DictionaryProvider>');
  }
  return ctx.locale;
}
