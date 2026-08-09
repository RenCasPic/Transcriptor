import { describe, expect, it } from 'vitest';
import { translateImportError, translateAudioFallbackError } from '@/lib/actions/youtube';

describe('translateImportError', () => {
  it('traduce NO_CAPTIONS', () => {
    expect(translateImportError('NO_CAPTIONS')).toMatch(/no tiene subtítulos/i);
  });

  it('traduce EMPTY_TRANSCRIPT', () => {
    expect(translateImportError('EMPTY_TRANSCRIPT')).toMatch(/no se pudo extraer contenido/i);
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
    expect(translateAudioFallbackError('YOUTUBE_PRIVATE_VIDEO')).toMatch(/privado/i);
  });

  it('traduce video no encontrado', () => {
    expect(translateAudioFallbackError('YOUTUBE_VIDEO_NOT_FOUND')).toMatch(/no se encontró/i);
  });

  it('traduce restricción de edad', () => {
    expect(translateAudioFallbackError('YOUTUBE_AGE_RESTRICTED')).toMatch(/restricción de edad/i);
  });

  it('traduce bloqueo por región', () => {
    expect(translateAudioFallbackError('YOUTUBE_REGION_BLOCKED')).toMatch(/región/i);
  });

  it('traduce transmisiones en vivo no soportadas', () => {
    expect(translateAudioFallbackError('YOUTUBE_LIVE_UNSUPPORTED')).toMatch(/en vivo/i);
  });

  it('traduce formato de audio incompatible', () => {
    expect(translateAudioFallbackError('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED')).toMatch(/formato de audio/i);
  });

  it('traduce duración excedida incluyendo el límite en minutos', () => {
    expect(translateAudioFallbackError('YOUTUBE_AUDIO_TOO_LONG')).toMatch(/\d+ minutos/);
  });

  it('traduce archivo demasiado grande', () => {
    expect(translateAudioFallbackError('TRANSCRIPTION_FILE_TOO_LARGE')).toMatch(/25 MB/);
  });

  it('traduce timeouts de extracción/descarga', () => {
    expect(translateAudioFallbackError('YOUTUBE_AUDIO_DOWNLOAD_TIMEOUT')).toMatch(/tardó demasiado/i);
    expect(translateAudioFallbackError('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT')).toMatch(/tardó demasiado/i);
  });

  it('traduce fallos de descarga/extracción', () => {
    expect(translateAudioFallbackError('YOUTUBE_AUDIO_DOWNLOAD_FAILED')).toMatch(/no se pudo descargar/i);
    expect(translateAudioFallbackError('YOUTUBE_AUDIO_EXTRACTION_FAILED')).toMatch(/no se pudo descargar/i);
  });

  it('traduce transcripción vacía', () => {
    expect(translateAudioFallbackError('EMPTY_TRANSCRIPT')).toMatch(/no se detectó voz/i);
  });

  it('distingue rate limit (429) de otros errores HTTP del proveedor', () => {
    expect(translateAudioFallbackError('TRANSCRIPTION_PROVIDER_HTTP_ERROR:429')).toMatch(/límite de uso/i);
    expect(translateAudioFallbackError('TRANSCRIPTION_PROVIDER_HTTP_ERROR:500')).toMatch(/no pudo procesar el audio/i);
  });

  it('devuelve un mensaje genérico para errores desconocidos', () => {
    expect(translateAudioFallbackError('ALGO_RARO')).toMatch(/no se pudo transcribir el audio/i);
  });
});
