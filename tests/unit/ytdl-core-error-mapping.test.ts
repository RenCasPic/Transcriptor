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

  it('mapea contenido solo para miembros a YOUTUBE_MEMBERS_ONLY', () => {
    expect(mapYtdlError(new Error('Join this channel to get access to members-only content')).message).toBe(
      'YOUTUBE_MEMBERS_ONLY',
    );
    expect(mapYtdlError(new Error('This video is available to this channel\'s members on level: ...')).message).toBe(
      'YOUTUBE_MEMBERS_ONLY',
    );
  });

  describe('YouTube rechaza al extractor (403 en el CDN)', () => {
    // Distinto de "la librería no sabe leer el reproductor actual"
    // (YOUTUBE_EXTRACTOR_INCOMPATIBLE): aquí YouTube devolvió explícitamente
    // un 403 al pedir el archivo de audio.
    const blockedMessages = [
      'Status code: 403',
      'Server returned HTTP error 403 Forbidden',
      'Request failed: 403 Forbidden',
    ];

    for (const message of blockedMessages) {
      it(`clasifica "${message}" como YOUTUBE_EXTRACTOR_BLOCKED`, () => {
        expect(mapYtdlError(new Error(message)).message).toBe('YOUTUBE_EXTRACTOR_BLOCKED');
      });
    }

    it('un 403 no se confunde con una incompatibilidad de descifrado', () => {
      expect(mapYtdlError(new Error('Status code: 403')).message).not.toContain('YOUTUBE_EXTRACTOR_INCOMPATIBLE');
    });

    it('deja pasar YOUTUBE_EXTRACTOR_BLOCKED ya codificado', () => {
      expect(mapYtdlError(new Error('YOUTUBE_EXTRACTOR_BLOCKED')).message).toBe('YOUTUBE_EXTRACTOR_BLOCKED');
    });
  });

  it('deja pasar sin cambios los errores ya codificados internamente (p. ej. de un timeout)', () => {
    expect(mapYtdlError(new Error('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT')).message).toBe(
      'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
    );
  });

  it('maneja valores que no son instancias de Error', () => {
    expect(mapYtdlError('unavailable').message).toBe('YOUTUBE_VIDEO_NOT_FOUND');
  });

  describe('incompatibilidad de descifrado con el reproductor actual de YouTube', () => {
    // Este es el caso que motivó el cambio: play-dl y @distube/ytdl-core
    // fallan hoy contra el reproductor actual de YouTube al no poder
    // descifrar sus firmas. Debe distinguirse claramente de: video privado,
    // eliminado, con restricción de edad, bloqueado por región, timeout,
    // error de Groq, o un bug interno de la aplicación (ver casos de abajo).
    const decipherMessages = [
      'Could not parse decipher function',
      'Could not parse n transform function',
      'Failed to find any playable formats',
      'Error extracting signature decipher algorithm',
    ];

    for (const message of decipherMessages) {
      it(`clasifica "${message}" como YOUTUBE_EXTRACTOR_INCOMPATIBLE`, () => {
        const mapped = mapYtdlError(new Error(message));
        expect(mapped.message).toBe(`YOUTUBE_EXTRACTOR_INCOMPATIBLE:${message}`);
      });
    }

    it('no confunde un timeout de nuestra propia app con una incompatibilidad del extractor', () => {
      const mapped = mapYtdlError(new Error('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT'));
      expect(mapped.message).not.toContain('YOUTUBE_EXTRACTOR_INCOMPATIBLE');
      expect(mapped.message).toBe('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT');
    });

    it('no confunde un error HTTP de Groq (ajeno al extractor) con una incompatibilidad del extractor', () => {
      // Este tipo de error nunca pasa por mapYtdlError en el flujo real
      // (lo lanza el proveedor de transcripción, no el extractor de audio),
      // pero si por algún motivo llegara aquí, no debe clasificarse como
      // incompatibilidad de YouTube.
      const mapped = mapYtdlError(new Error('TRANSCRIPTION_PROVIDER_HTTP_ERROR:500'));
      expect(mapped.message).not.toContain('YOUTUBE_EXTRACTOR_INCOMPATIBLE');
    });

    it('no confunde una URL inválida con una incompatibilidad del extractor', () => {
      const mapped = mapYtdlError(new Error('No video id found: "not-a-url"'));
      expect(mapped.message).toBe('YOUTUBE_VIDEO_NOT_FOUND');
    });

    it('no confunde un video privado con una incompatibilidad del extractor', () => {
      expect(mapYtdlError(new Error('This is a private video')).message).not.toContain(
        'YOUTUBE_EXTRACTOR_INCOMPATIBLE',
      );
    });

    it('no confunde un video eliminado con una incompatibilidad del extractor', () => {
      expect(mapYtdlError(new Error('Video unavailable')).message).not.toContain('YOUTUBE_EXTRACTOR_INCOMPATIBLE');
    });

    it('no confunde un error interno inesperado de nuestra app con una incompatibilidad de YouTube', () => {
      // Un bug propio (p. ej. un TypeError) no debe leerse como "YouTube
      // cambió algo": cae en el genérico YOUTUBE_AUDIO_EXTRACTION_FAILED,
      // no en YOUTUBE_EXTRACTOR_INCOMPATIBLE.
      const mapped = mapYtdlError(new TypeError("Cannot read properties of undefined (reading 'foo')"));
      expect(mapped.message).not.toContain('YOUTUBE_EXTRACTOR_INCOMPATIBLE');
      expect(mapped.message).toContain('YOUTUBE_AUDIO_EXTRACTION_FAILED');
    });
  });
});
