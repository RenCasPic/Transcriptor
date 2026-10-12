import { beforeEach, describe, expect, it } from 'vitest';
import {
  FALLBACK_APP_PATH,
  LAST_APP_PATH_KEY,
  isReturnablePath,
  readLastAppPath,
  rememberAppPath,
  resolveReturnPath,
} from '@/lib/navigation/last-app-path';

describe('última página de trabajo (volver desde Configuración)', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('solo se puede volver a rutas internas que no son Configuración', () => {
    expect(isReturnablePath('/projects/abc/editor')).toBe(true);
    expect(isReturnablePath('/dashboard')).toBe(true);
    expect(isReturnablePath('/settings/profile')).toBe(false);
    expect(isReturnablePath('//evil.example.com')).toBe(false);
    expect(isReturnablePath('https://evil.example.com')).toBe(false);
    expect(isReturnablePath('')).toBe(false);
    expect(isReturnablePath(null)).toBe(false);
  });

  it('resuelve la ruta guardada o, si no es válida, el dashboard', () => {
    expect(resolveReturnPath('/projects/abc/editor')).toBe('/projects/abc/editor');
    expect(resolveReturnPath('//evil.example.com')).toBe(FALLBACK_APP_PATH);
    expect(resolveReturnPath(null)).toBe(FALLBACK_APP_PATH);
  });

  it('recuerda el editor aunque después se visite Configuración (y sus pestañas)', () => {
    rememberAppPath('/projects/abc/editor');
    rememberAppPath('/settings/profile');
    rememberAppPath('/settings/workspace');
    expect(window.sessionStorage.getItem(LAST_APP_PATH_KEY)).toBe('/projects/abc/editor');
    expect(readLastAppPath()).toBe('/projects/abc/editor');
  });

  it('sin nada guardado vuelve al dashboard', () => {
    expect(readLastAppPath()).toBe(FALLBACK_APP_PATH);
  });
});
