import { describe, expect, it } from 'vitest';
import { translateImportError, translateAudioFallbackError, extractYoutubeErrorCode } from '@/lib/actions/youtube-errors';

const MAX_DURATION_SECONDS = 5400;
const translate = (message: string) => translateAudioFallbackError(message, MAX_DURATION_SECONDS);

describe('translateImportError', () => {
  it('traduce NO_CAPTIONS', () => {
    expect(translateImportError('NO_CAPTIONS')).toMatch(/no tiene subtítulos/i);
  });

  it('traduce EMPTY_TRANSCRIPT', () => {
    expect(translateImportError('EMPTY_TRANSCRIPT')).toMatch(/no se pudo extraer contenido/i);
  });

  it('traduce TRANSCRIPT_FETCH_PARSE_ERROR igual que EMPTY_TRANSCRIPT', () => {
    expect(translateImportError('TRANSCRIPT_FETCH_PARSE_ERROR')).toMatch(/no se pudo extraer contenido/i);
  });

  it('traduce errores de fetch de la página o de la pista de subtítulos', () => {
    expect(translateImportError('YOUTUBE_PAGE_FETCH_ERROR:404')).toMatch(/no se pudo acceder/i);
    expect(translateImportError('YOUTUBE_TRANSCRIPT_FETCH_ERROR:500')).toMatch(/no se pudo acceder/i);
  });

  it('devuelve un mensaje genérico para errores desconocidos', () => {
    expect(translateImportError('ALGO_RARO')).toMatch(/no se pudo importar el video/i);
  });
});

describe('translateAudioFallbackError', () => {
  it('traduce video privado', () => {
    expect(translate('YOUTUBE_PRIVATE_VIDEO')).toMatch(/privado/i);
  });

  it('traduce video no encontrado', () => {
    expect(translate('YOUTUBE_VIDEO_NOT_FOUND')).toMatch(/no se encontró/i);
  });

  it('traduce restricción de edad', () => {
    expect(translate('YOUTUBE_AGE_RESTRICTED')).toMatch(/restricción de edad/i);
  });

  it('traduce bloqueo por región', () => {
    expect(translate('YOUTUBE_REGION_BLOCKED')).toMatch(/región/i);
  });

  it('traduce transmisiones en vivo no soportadas', () => {
    expect(translate('YOUTUBE_LIVE_UNSUPPORTED')).toMatch(/en vivo/i);
  });

  it('traduce formato de audio incompatible', () => {
    expect(translate('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED')).toMatch(/formato de audio/i);
  });

  it('traduce duración excedida incluyendo el límite en minutos', () => {
    expect(translate('YOUTUBE_AUDIO_TOO_LONG')).toMatch(/\d+ minutos/);
  });

  it('traduce archivo demasiado grande', () => {
    expect(translate('TRANSCRIPTION_FILE_TOO_LARGE')).toMatch(/25 MB/);
  });

  it('traduce timeouts de extracción/descarga', () => {
    expect(translate('YOUTUBE_AUDIO_DOWNLOAD_TIMEOUT')).toMatch(/tardó demasiado/i);
    expect(translate('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT')).toMatch(/tardó demasiado/i);
  });

  it('traduce fallos de descarga/extracción, preservando el detalle original cuando lo hay', () => {
    expect(translate('YOUTUBE_AUDIO_DOWNLOAD_FAILED')).toMatch(/no se pudo descargar/i);
    expect(translate('YOUTUBE_AUDIO_EXTRACTION_FAILED:algo raro de play-dl')).toMatch(
      /no se pudo descargar.*algo raro de play-dl/is,
    );
  });

  it('traduce transcripción vacía', () => {
    expect(translate('EMPTY_TRANSCRIPT')).toMatch(/no se detectó voz/i);
  });

  it('distingue rate limit (429) de otros errores HTTP del proveedor', () => {
    expect(translate('TRANSCRIPTION_PROVIDER_HTTP_ERROR:429')).toMatch(/límite de uso/i);
    expect(translate('TRANSCRIPTION_PROVIDER_HTTP_ERROR:500')).toMatch(/no pudo procesar el audio/i);
  });

  it('devuelve un mensaje genérico para errores desconocidos', () => {
    expect(translate('ALGO_RARO')).toMatch(/no se pudo transcribir el audio/i);
  });

  describe('YOUTUBE_EXTRACTOR_INCOMPATIBLE', () => {
    it('explica que el cambio viene de YouTube, sin sugerir que el usuario hizo algo mal', () => {
      const message = translate('YOUTUBE_EXTRACTOR_INCOMPATIBLE:Failed to find any playable formats');
      expect(message).toMatch(/youtube cambió/i);
      expect(message).not.toMatch(/verifica|inválid|privado|eliminado/i);
    });

    it('funciona igual sin un detalle adjunto', () => {
      expect(translate('YOUTUBE_EXTRACTOR_INCOMPATIBLE')).toMatch(/youtube cambió/i);
    });
  });
});

describe('extractYoutubeErrorCode', () => {
  it('devuelve el código base sin el detalle cuando hay uno', () => {
    expect(extractYoutubeErrorCode('YOUTUBE_EXTRACTOR_INCOMPATIBLE:Failed to find any playable formats')).toBe(
      'YOUTUBE_EXTRACTOR_INCOMPATIBLE',
    );
  });

  it('devuelve el mensaje completo cuando no hay separador', () => {
    expect(extractYoutubeErrorCode('YOUTUBE_PRIVATE_VIDEO')).toBe('YOUTUBE_PRIVATE_VIDEO');
  });
});
