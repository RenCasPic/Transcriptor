import { describe, expect, it } from 'vitest';
import { mapPlayDlError } from '@/lib/integrations/audio-extractor/play-dl-extractor';

describe('mapPlayDlError', () => {
  it('mapea mensajes que mencionan "private" a YOUTUBE_PRIVATE_VIDEO', () => {
    expect(mapPlayDlError(new Error('This is a private video')).message).toBe('YOUTUBE_PRIVATE_VIDEO');
  });

  it('mapea mensajes de restricción de edad a YOUTUBE_AGE_RESTRICTED', () => {
    expect(mapPlayDlError(new Error('Sign in to confirm your age')).message).toBe('YOUTUBE_AGE_RESTRICTED');
  });

  it('mapea mensajes de video no disponible a YOUTUBE_VIDEO_NOT_FOUND', () => {
    expect(mapPlayDlError(new Error('Video unavailable')).message).toBe('YOUTUBE_VIDEO_NOT_FOUND');
  });

  it('mapea mensajes sobre región a YOUTUBE_REGION_BLOCKED', () => {
    expect(mapPlayDlError(new Error('Not available in your country')).message).toBe('YOUTUBE_REGION_BLOCKED');
  });

  it('cae en YOUTUBE_AUDIO_EXTRACTION_FAILED preservando el mensaje original para mensajes desconocidos', () => {
    expect(mapPlayDlError(new Error('algo totalmente inesperado')).message).toBe(
      'YOUTUBE_AUDIO_EXTRACTION_FAILED:algo totalmente inesperado',
    );
  });

  it('deja pasar sin cambios los errores ya codificados internamente (p. ej. de un timeout)', () => {
    expect(mapPlayDlError(new Error('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT')).message).toBe(
      'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
    );
  });

  it('maneja valores que no son instancias de Error', () => {
    expect(mapPlayDlError('unavailable').message).toBe('YOUTUBE_VIDEO_NOT_FOUND');
  });
});
