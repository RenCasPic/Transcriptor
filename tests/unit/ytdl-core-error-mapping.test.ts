import { describe, expect, it } from 'vitest';
import { mapYtdlError } from '@/lib/integrations/audio-extractor/ytdl-core-extractor';

describe('mapYtdlError', () => {
  it('mapea mensajes que mencionan "private" a YOUTUBE_PRIVATE_VIDEO', () => {
    expect(mapYtdlError(new Error('This is a private video')).message).toBe('YOUTUBE_PRIVATE_VIDEO');
  });

  it('mapea mensajes de restricción de edad a YOUTUBE_AGE_RESTRICTED', () => {
    expect(mapYtdlError(new Error('Sign in to confirm your age')).message).toBe('YOUTUBE_AGE_RESTRICTED');
  });

  it('mapea mensajes de video no disponible a YOUTUBE_VIDEO_NOT_FOUND', () => {
    expect(mapYtdlError(new Error('Video unavailable')).message).toBe('YOUTUBE_VIDEO_NOT_FOUND');
  });

  it('mapea mensajes sobre región a YOUTUBE_REGION_BLOCKED', () => {
    expect(mapYtdlError(new Error('Not available in your country')).message).toBe('YOUTUBE_REGION_BLOCKED');
  });

  it('cae en YOUTUBE_AUDIO_EXTRACTION_FAILED preservando el mensaje original para mensajes desconocidos (p. ej. fallas de descifrado)', () => {
    expect(mapYtdlError(new Error('Could not parse decipher function')).message).toBe(
      'YOUTUBE_AUDIO_EXTRACTION_FAILED:Could not parse decipher function',
    );
  });

  it('deja pasar sin cambios los errores ya codificados internamente (p. ej. de un timeout)', () => {
    expect(mapYtdlError(new Error('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT')).message).toBe(
      'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
    );
  });

  it('maneja valores que no son instancias de Error', () => {
    expect(mapYtdlError('unavailable').message).toBe('YOUTUBE_VIDEO_NOT_FOUND');
  });
});
