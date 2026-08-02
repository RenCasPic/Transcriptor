import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/content/slug';

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
