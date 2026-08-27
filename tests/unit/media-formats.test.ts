import { describe, expect, it } from 'vitest';
import {
  MEDIA_ACCEPT_ATTR,
  SUPPORTED_MEDIA_MIME_TYPES,
  mediaFormatForExtension,
  validateMediaUpload,
} from '@/lib/media/formats';

const MB = 1024 * 1024;
const MAX = 500 * MB;

describe('validateMediaUpload', () => {
  it('acepta un mp4 grande (500 MB) — el límite ya no es 25 MB', () => {
    const result = validateMediaUpload({
      filename: 'entrevista.mp4',
      contentType: 'video/mp4',
      sizeBytes: 480 * MB,
      maxUploadBytes: MAX,
    });
    expect(result).toEqual({ ok: true, extension: 'mp4', sourceType: 'video' });
  });

  it('acepta formatos nuevos (mkv, flac, ogg, aac)', () => {
    for (const [name, sourceType] of [
      ['clip.mkv', 'video'],
      ['audio.flac', 'audio'],
      ['pod.ogg', 'audio'],
      ['voz.aac', 'audio'],
    ] as const) {
      const result = validateMediaUpload({ filename: name, contentType: null, sizeBytes: MB, maxUploadBytes: MAX });
      expect(result.ok && result.sourceType).toBe(sourceType);
    }
  });

  it('rechaza por tamaño solo cuando supera el máximo configurado', () => {
    expect(
      validateMediaUpload({ filename: 'a.mp3', contentType: null, sizeBytes: MAX + 1, maxUploadBytes: MAX }).ok,
    ).toBe(false);
    expect(
      validateMediaUpload({ filename: 'a.mp3', contentType: null, sizeBytes: MAX, maxUploadBytes: MAX }).ok,
    ).toBe(true);
  });

  it('rechaza formatos no soportados', () => {
    const result = validateMediaUpload({
      filename: 'documento.pdf',
      contentType: 'application/pdf',
      sizeBytes: MB,
      maxUploadBytes: MAX,
    });
    expect(result).toEqual({ ok: false, code: 'UNSUPPORTED_MEDIA_FORMAT' });
  });

  it('rechaza cuando el MIME contradice a otro formato conocido (extensión falseada)', () => {
    const result = validateMediaUpload({
      filename: 'malicioso.mp3',
      contentType: 'video/mp4',
      sizeBytes: MB,
      maxUploadBytes: MAX,
    });
    expect(result).toEqual({ ok: false, code: 'UNSUPPORTED_MEDIA_FORMAT' });
  });

  it('deja pasar un MIME genérico o desconocido si la extensión es válida', () => {
    expect(
      validateMediaUpload({
        filename: 'grabacion.m4a',
        contentType: 'application/octet-stream',
        sizeBytes: MB,
        maxUploadBytes: MAX,
      }).ok,
    ).toBe(true);
  });

  it('rechaza archivos vacíos o sin nombre', () => {
    expect(validateMediaUpload({ filename: '', contentType: null, sizeBytes: 10, maxUploadBytes: MAX }).ok).toBe(false);
    expect(
      validateMediaUpload({ filename: 'x.mp4', contentType: null, sizeBytes: 0, maxUploadBytes: MAX }).ok,
    ).toBe(false);
  });
});

describe('tablas derivadas', () => {
  it('MEDIA_ACCEPT_ATTR lista extensiones con punto', () => {
    expect(MEDIA_ACCEPT_ATTR).toContain('.mp4');
    expect(MEDIA_ACCEPT_ATTR).toContain('.flac');
  });

  it('SUPPORTED_MEDIA_MIME_TYPES no tiene duplicados', () => {
    expect(new Set(SUPPORTED_MEDIA_MIME_TYPES).size).toBe(SUPPORTED_MEDIA_MIME_TYPES.length);
  });

  it('mediaFormatForExtension normaliza el punto y las mayúsculas', () => {
    expect(mediaFormatForExtension('.MP4')?.sourceType).toBe('video');
  });
});
