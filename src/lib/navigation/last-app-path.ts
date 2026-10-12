/**
 * "Última página de trabajo": la última ruta de la app que NO es Configuración.
 * El header la guarda en sessionStorage para que desde Perfil / Espacio de
 * trabajo se pueda volver exactamente a donde se estaba (p. ej. el editor de un
 * artículo), aunque se cambie entre las pestañas de Configuración.
 */
export const LAST_APP_PATH_KEY = 'lastAppPath';
export const FALLBACK_APP_PATH = '/dashboard';

/** Si la ruta es una página de trabajo a la que tiene sentido volver. */
export function isReturnablePath(pathname: string | null | undefined): pathname is string {
  if (!pathname) return false;
  // Solo rutas internas ("/algo"): nunca "//otro-sitio" ni URLs absolutas.
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return false;
  return !pathname.startsWith('/settings');
}

/** Ruta a la que volver desde Configuración (la guardada si es válida; si no, el dashboard). */
export function resolveReturnPath(stored: string | null | undefined): string {
  return isReturnablePath(stored) ? stored : FALLBACK_APP_PATH;
}

/** Guarda la ruta actual si es una página de trabajo. Nunca lanza (el almacenamiento puede estar bloqueado). */
export function rememberAppPath(pathname: string | null | undefined): void {
  if (!isReturnablePath(pathname)) return;
  try {
    window.sessionStorage.setItem(LAST_APP_PATH_KEY, pathname);
  } catch {
    /* sin almacenamiento: el botón volverá al dashboard */
  }
}

export function readLastAppPath(): string {
  try {
    return resolveReturnPath(window.sessionStorage.getItem(LAST_APP_PATH_KEY));
  } catch {
    return FALLBACK_APP_PATH;
  }
}
