import { describe, expect, it } from 'vitest';
import { shouldExtractAudio } from '@/lib/media/extract-audio-client';

const MB = 1024 * 1024;
const THRESHOLD = 15 * MB;

describe('shouldExtractAudio', () => {
  it('NO extrae un audio pequeño (se sube tal cual)', () => {
    expect(shouldExtractAudio('charla.mp3', 8 * MB, THRESHOLD)).toBe(false);
    expect(shouldExtractAudio('nota.m4a', THRESHOLD, THRESHOLD)).toBe(false);
  });

  it('SÍ extrae un audio grande', () => {
    expect(shouldExtractAudio('podcast.mp3', 40 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('entrevista.wav', 300 * MB, THRESHOLD)).toBe(true);
  });

  it('SÍ extrae siempre el video, por pequeño que sea', () => {
    expect(shouldExtractAudio('clip.mp4', 2 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('screencast.webm', 500 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('grabacion.mkv', 1 * MB, THRESHOLD)).toBe(true);
  });

  it('trata un formato desconocido como "hay que intentar extraer"', () => {
    expect(shouldExtractAudio('archivo.xyz', 1 * MB, THRESHOLD)).toBe(true);
  });
});
