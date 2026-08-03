import { describe, expect, it } from 'vitest';
import { selectCaptionTrack, type YoutubeCaptionTrack } from '@/lib/integrations/youtube-client';

function track(language: string, isAsr: boolean): YoutubeCaptionTrack {
  return { captionId: `${language}-${isAsr ? 'asr' : 'manual'}`, language, isAsr };
}

describe('selectCaptionTrack', () => {
  it('devuelve null si no hay pistas disponibles', () => {
    expect(selectCaptionTrack([], 'es')).toBeNull();
  });

  it('prioriza la pista manual que coincide con el idioma pedido', () => {
    const tracks = [track('en', false), track('es', true), track('es', false)];
    expect(selectCaptionTrack(tracks, 'es')).toEqual(track('es', false));
  });

  it('si no hay pista manual en el idioma pedido, usa cualquier pista manual', () => {
    const tracks = [track('es', true), track('en', false)];
    expect(selectCaptionTrack(tracks, 'es')).toEqual(track('en', false));
  });

  it('si solo hay pistas ASR, prefiere la del idioma pedido', () => {
    const tracks = [track('en', true), track('es', true)];
    expect(selectCaptionTrack(tracks, 'es')).toEqual(track('es', true));
  });

  it('si nada coincide, cae a la primera pista disponible', () => {
    const tracks = [track('en', true), track('fr', true)];
    expect(selectCaptionTrack(tracks, 'es')).toEqual(track('en', true));
  });
});
