import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isForcedLightPath,
  isTheme,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from '@/lib/theme/theme';

describe('isTheme', () => {
  it('acepta solo los tres valores válidos', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('"system" sigue la preferencia del sistema; los demás ignoran el sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isForcedLightPath', () => {
  it('fuerza el modo claro en /embed y sus subrutas, y en ninguna otra', () => {
    expect(isForcedLightPath('/embed/abc')).toBe(true);
    expect(isForcedLightPath('/embed')).toBe(true);
    expect(isForcedLightPath('/embedded')).toBe(false);
    expect(isForcedLightPath('/dashboard')).toBe(false);
    expect(isForcedLightPath('/')).toBe(false);
    expect(isForcedLightPath(null)).toBe(false);
  });
});

describe('THEME_INIT_SCRIPT (script del <head>)', () => {
  function mockSystemDark(dark: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({ matches: dark }) as unknown as typeof window.matchMedia;
  }
  const run = () => new Function(THEME_INIT_SCRIPT)();

  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('sin preferencia guardada, sigue al sistema', () => {
    mockSystemDark(true);
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    document.documentElement.classList.remove('dark');
    mockSystemDark(false);
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('una elección guardada (claro/oscuro) gana sobre el sistema', () => {
    mockSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    mockSystemDark(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('en /embed/* nunca deja la clase "dark", aunque el usuario haya elegido oscuro', () => {
    mockSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.classList.add('dark');
    window.history.pushState({}, '', '/embed/abc-123');
    run();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('no lanza si localStorage o matchMedia fallan', () => {
    window.matchMedia = vi.fn(() => {
      throw new Error('sin matchMedia');
    }) as unknown as typeof window.matchMedia;
    expect(run).not.toThrow();
  });
});
