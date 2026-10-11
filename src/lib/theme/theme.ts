export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Rutas que se muestran SIEMPRE en modo claro, sin importar la preferencia del
 * usuario: los artículos incrustados (`/embed/*`) viven dentro de sitios de
 * terceros y no deben heredar el tema de la app.
 */
export function isForcedLightPath(pathname: string | null | undefined): boolean {
  return !!pathname && /^\/embed(\/|$)/.test(pathname);
}

export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light';
  return theme;
}

/**
 * Script que se ejecuta en el <head>, ANTES del primer pintado, para poner (o
 * no) la clase "dark" en <html> y evitar el parpadeo blanco al cargar. Debe
 * mantenerse autónomo (sin imports) y a prueba de errores: si localStorage o
 * matchMedia no están disponibles, la página simplemente queda en claro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var r=document.documentElement;if(/^\\/embed(\\/|$)/.test(location.pathname)){r.classList.remove('dark');return;}var s=localStorage.getItem('${THEME_STORAGE_KEY}');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',d);}catch(e){}})();`;
