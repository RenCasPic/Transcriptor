import type { Locale } from '../config';
import { es } from './es';
import { en } from './en';
import type { Dictionary } from './es';

export type { Dictionary };

export const dictionaries: Record<Locale, Dictionary> = {
  es,
  en,
};
