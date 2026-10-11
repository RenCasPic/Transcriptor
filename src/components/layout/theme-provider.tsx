'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  isForcedLightPath,
  isTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme/theme';

interface ThemeContextValue {
  /** Lo que eligió el usuario: claro, oscuro o seguir al sistema. */
  theme: Theme;
  /** Lo que se está mostrando realmente (nunca "system"). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Pone/quita la clase "dark" en <html>. Lee `matchMedia` directamente (en vez
 * de un estado) para no quitar por un instante la clase que el script del
 * <head> ya puso correctamente antes del primer pintado.
 */
function applyTheme(theme: Theme, forcedLight: boolean) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = !forcedLight && resolveTheme(theme, prefersDark) === 'dark';
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const forcedLight = isForcedLightPath(pathname);
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemDark, setSystemDark] = useState(false);

  // Preferencia del sistema, en vivo (solo se nota cuando el tema es "system").
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Si el usuario cambia el tema en otra pestaña, esta se sincroniza.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(isTheme(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // `systemDark` está en las dependencias solo para volver a aplicar el tema
  // cuando el sistema cambia mientras se está en "system".
  useEffect(() => {
    applyTheme(theme, forcedLight);
  }, [theme, forcedLight, systemDark]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* localStorage no disponible (modo privado, etc.): el tema vale solo para esta sesión. */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme: forcedLight ? 'light' : resolveTheme(theme, systemDark),
      setTheme,
    }),
    [theme, systemDark, forcedLight, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}
