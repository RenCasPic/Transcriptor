'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { FALLBACK_APP_PATH, readLastAppPath } from '@/lib/navigation/last-app-path';

/**
 * "Volver" en Configuración: lleva a la última página de trabajo (p. ej. el
 * editor del artículo que se estaba editando) o, si no hay ninguna, al dashboard.
 */
export function SettingsBackLink() {
  const t = useDictionary();
  const [returnTo, setReturnTo] = useState(FALLBACK_APP_PATH);

  useEffect(() => {
    setReturnTo(readLastAppPath());
  }, []);

  const toEditor = returnTo.endsWith('/editor');

  return (
    <Link
      href={returnTo}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-4 w-4" />
      {toEditor ? t.settings.backToArticle : t.settings.back}
    </Link>
  );
}
