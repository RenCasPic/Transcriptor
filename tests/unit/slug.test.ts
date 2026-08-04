import { describe, expect, it } from 'vitest';
import { slugify, sanitizeFilename } from '@/lib/content/slug';

describe('slugify', () => {
  it('convierte a minúsculas y reemplaza espacios por guiones', () => {
    expect(slugify('Plan de Contenidos Trimestral')).toBe('plan-de-contenidos-trimestral');
  });

  it('elimina acentos y diacríticos', () => {
    expect(slugify('Cómo estructurar sesión difícil')).toBe('como-estructurar-sesion-dificil');
  });

  it('elimina caracteres especiales', () => {
    expect(slugify('¿Qué es el SEO? (guía 2024)')).toBe('que-es-el-seo-guia-2024');
  });

  it('colapsa guiones repetidos y recorta los extremos', () => {
    expect(slugify('  --Hola--Mundo--  ')).toBe('hola-mundo');
  });
});

describe('sanitizeFilename', () => {
  it('conserva la extensión y sanea el resto del nombre', () => {
    expect(sanitizeFilename('ORACIÓN MACUMBA-copia.mp4')).toBe('oracion-macumba-copia.mp4');
  });

  it('sanea también la extensión si tiene mayúsculas o acentos', () => {
    expect(sanitizeFilename('video.MP4')).toBe('video.mp4');
  });

  it('usa un nombre por defecto si el nombre base queda vacío tras sanear', () => {
    expect(sanitizeFilename('¿¡?.mp3')).toBe('archivo.mp3');
  });

  it('funciona sin extensión', () => {
    expect(sanitizeFilename('Sin Extensión')).toBe('sin-extension');
  });
});
