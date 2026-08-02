import { describe, expect, it } from 'vitest';
import { normalizePlainText, normalizeSrt, normalizeVtt, normalizeTranscript } from '@/lib/content/normalize';

describe('normalizePlainText', () => {
  it('divide párrafos separados por líneas en blanco', () => {
    const result = normalizePlainText('Primer párrafo.\n\nSegundo párrafo.\n\nTercero.');
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]!.text).toBe('Primer párrafo.');
  });

  it('detecta el hablante cuando el párrafo empieza con "Nombre:"', () => {
    const result = normalizePlainText('Marina Ortiz: Hola a todos, bienvenidos.');
    expect(result.segments[0]!.speaker).toBe('Marina Ortiz');
    expect(result.segments[0]!.text).toBe('Hola a todos, bienvenidos.');
  });

  it('colapsa espacios y saltos de línea internos', () => {
    const result = normalizePlainText('Texto   con    espacios\nirregulares.');
    expect(result.segments[0]!.text).toBe('Texto con espacios irregulares.');
  });
});

describe('normalizeSrt', () => {
  const srt = `1
00:00:00,000 --> 00:00:04,000
Hola, bienvenidos al episodio.

2
00:00:04,500 --> 00:00:08,000
Hoy hablaremos de contenidos.`;

  it('extrae segmentos con timestamps en segundos', () => {
    const result = normalizeSrt(srt);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]!.startSeconds).toBe(0);
    expect(result.segments[0]!.endSeconds).toBe(4);
    expect(result.segments[1]!.startSeconds).toBe(4.5);
    expect(result.segments[0]!.text).toBe('Hola, bienvenidos al episodio.');
  });
});

describe('normalizeVtt', () => {
  const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Primer segmento del video.

00:00:03.000 --> 00:00:06.000
Segundo segmento del video.`;

  it('ignora la cabecera WEBVTT y extrae los segmentos', () => {
    const result = normalizeVtt(vtt);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]!.text).toBe('Primer segmento del video.');
    expect(result.segments[1]!.startSeconds).toBe(3);
  });
});

describe('normalizeTranscript', () => {
  it('despacha según el tipo de fuente', () => {
    const txt = normalizeTranscript('Hola mundo.', 'txt');
    expect(txt.segments).toHaveLength(1);
  });
});
