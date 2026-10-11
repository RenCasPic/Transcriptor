'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { THEMES, type Theme } from '@/lib/theme/theme';
import { useTheme } from './theme-provider';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** Selector de tema (Claro / Oscuro / Sistema), con el mismo formato que LanguageSwitcher. */
export function ThemeSwitcher() {
  const t = useDictionary();
  const { theme, setTheme } = useTheme();

  const labels: Record<Theme, string> = {
    light: t.theme.light,
    dark: t.theme.dark,
    system: t.theme.system,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {/* Sol/luna alternados por CSS (clase "dark" de <html>): así no hay
              desajuste de hidratación aunque el tema real solo se conozca en el cliente. */}
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t.theme.toggle}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEMES.map((value) => {
          const Icon = ICONS[value];
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={value === theme ? 'gap-2 font-semibold' : 'gap-2'}
            >
              <Icon className="h-4 w-4" />
              {labels[value]}
              {value === theme && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
