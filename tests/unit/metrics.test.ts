import { describe, expect, it } from 'vitest';
import { countWords, estimateReadingTimeMinutes, secondsToTimestamp } from '@/lib/content/metrics';

describe('countWords', () => {
  it('cuenta palabras separadas por espacios', () => {
    expect(countWords('Hola mundo, esto es una prueba')).toBe(6);
  });

  it('devuelve 0 para texto vacío', () => {
    expect(countWords('   ')).toBe(0);
    expect(countWords('')).toBe(0);
  });

  it('ignora espacios múltiples', () => {
    expect(countWords('uno    dos     tres')).toBe(3);
  });
});

describe('estimateReadingTimeMinutes', () => {
  it('devuelve 0 para 0 palabras', () => {
    expect(estimateReadingTimeMinutes(0)).toBe(0);
  });

  it('redondea hacia arriba y respeta un mínimo de 1 minuto', () => {
    expect(estimateReadingTimeMinutes(50)).toBe(1);
    expect(estimateReadingTimeMinutes(200)).toBe(1);
    expect(estimateReadingTimeMinutes(201)).toBe(2);
    expect(estimateReadingTimeMinutes(1000)).toBe(5);
  });
});

describe('secondsToTimestamp', () => {
  it('formatea segundos como mm:ss', () => {
    expect(secondsToTimestamp(0)).toBe('0:00');
    expect(secondsToTimestamp(65)).toBe('1:05');
    expect(secondsToTimestamp(599)).toBe('9:59');
  });

  it('formatea como hh:mm:ss cuando supera una hora', () => {
    expect(secondsToTimestamp(3661)).toBe('1:01:01');
  });

  it('nunca devuelve valores negativos', () => {
    expect(secondsToTimestamp(-5)).toBe('0:00');
  });
});
