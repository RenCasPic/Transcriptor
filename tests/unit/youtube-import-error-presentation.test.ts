import { describe, expect, it } from 'vitest';
import { youtubeImportErrorPresentation } from '@/components/dashboard/youtube-import-error-presentation';
import { es } from '@/lib/i18n/dictionaries/es';
import { en } from '@/lib/i18n/dictionaries/en';

const copy = es.dashboard.importError;

describe('youtubeImportErrorPresentation', () => {
  it('usa el título y tips de "bloqueado" para YOUTUBE_EXTRACTOR_BLOCKED', () => {
    const { title, tips } = youtubeImportErrorPresentation('YOUTUBE_EXTRACTOR_BLOCKED', copy);
    expect(title).toBe(copy.extractorBlockedTitle);
    expect(tips).toEqual([copy.extractorBlockedTip1, copy.extractorBlockedTip2]);
  });

  it('usa el título y tips de "incompatible" para YOUTUBE_EXTRACTOR_INCOMPATIBLE', () => {
    const { title, tips } = youtubeImportErrorPresentation('YOUTUBE_EXTRACTOR_INCOMPATIBLE', copy);
    expect(title).toBe(copy.extractorIncompatibleTitle);
    expect(tips).toEqual([copy.extractorIncompatibleTip1, copy.extractorIncompatibleTip2]);
  });

  it('agrupa privado / solo-miembros / restricción de edad bajo "restringido"', () => {
    for (const code of ['YOUTUBE_PRIVATE_VIDEO', 'YOUTUBE_MEMBERS_ONLY', 'YOUTUBE_AGE_RESTRICTED']) {
      const { title, tips } = youtubeImportErrorPresentation(code, copy);
      expect(title).toBe(copy.restrictedTitle);
      expect(tips).toEqual([copy.restrictedTip1, copy.restrictedTip2]);
    }
  });

  it('agrupa "audio demasiado grande / vídeo muy largo" bajo "demasiado largo"', () => {
    for (const code of ['TRANSCRIPTION_FILE_TOO_LARGE', 'YOUTUBE_AUDIO_TOO_LONG']) {
      const { title, tips } = youtubeImportErrorPresentation(code, copy);
      expect(title).toBe(copy.tooLongTitle);
      expect(tips).toEqual([copy.tooLongTip1, copy.tooLongTip2]);
    }
  });

  it('cae en el genérico para códigos desconocidos', () => {
    const { title, tips } = youtubeImportErrorPresentation('ALGO_RARO', copy);
    expect(title).toBe(copy.title);
    expect(tips).toEqual([copy.youtubeTip1, copy.youtubeTip2, copy.youtubeTip3]);
  });

  it('el diccionario en inglés expone las mismas claves', () => {
    const { title, tips } = youtubeImportErrorPresentation('YOUTUBE_EXTRACTOR_BLOCKED', en.dashboard.importError);
    expect(title).toBe(en.dashboard.importError.extractorBlockedTitle);
    expect(tips.every(Boolean)).toBe(true);
  });
});
