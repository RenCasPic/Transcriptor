'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { THEMES, type Theme } from '@/lib/theme/theme';
import { cn } from '@/lib/utils';
import { useTheme } from './theme-provider';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/**
 * Selector de tema "☀ Claro | 🌙 Oscuro | 🖥 Sistema": las tres opciones siempre
 * visibles y un solo clic para cambiar. Mismo formato que LanguageSwitcher; en
 * pantallas menores a lg muestra solo los iconos (salvo `showLabels`, que
 * muestra siempre los nombres, p. ej. dentro del menú móvil).
 */
export function ThemeSwitcher({ className, showLabels = false }: { className?: string; showLabels?: boolean }) {
  const t = useDictionary();
  const { theme, setTheme } = useTheme();

  // El tema guardado solo se conoce en el cliente: hasta montar no se resalta
  // ninguna opción para que el HTML del servidor y el del cliente coincidan.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const copy: Record<Theme, { label: string; title: string }> = {
    light: { label: t.theme.light, title: t.theme.lightTitle },
    dark: { label: t.theme.dark, title: t.theme.darkTitle },
    system: { label: t.theme.system, title: t.theme.systemTitle },
  };

  return (
    <div
      role="group"
      aria-label={t.theme.toggle}
      className={cn(
        'inline-flex h-9 items-center gap-0.5 rounded-md border border-primary/30 bg-muted/60 p-0.5 text-xs',
        className,
      )}
    >
      {THEMES.map((value) => {
        const Icon = ICONS[value];
        const active = mounted && value === theme;
        return (
          <button
            key={value}
            type="button"
            title={copy[value].title}
            aria-label={copy[value].title}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-[0.3rem] px-1.5 leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-2.5',
              active ? 'bg-accent font-bold text-primary' : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className={showLabels ? undefined : 'hidden lg:inline'}>{copy[value].label}</span>
          </button>
        );
      })}
    </div>
  );
}
