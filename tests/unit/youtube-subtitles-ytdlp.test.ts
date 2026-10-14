import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchTranscript = vi.fn();
vi.mock('@/lib/integrations/youtube-transcript', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/integrations/youtube-transcript')>()),
  fetchYoutubeTranscript: (...args: unknown[]) => fetchTranscript(...args),
}));
const resolveBinary = vi.fn();
vi.mock('@/lib/integrations/audio-extractor/ytdlp-binary', () => ({
  resolveYtDlpBinary: () => resolveBinary(),
}));

import { timedTextEventsToSegments } from '@/lib/integrations/youtube-transcript';
import { fetchYoutubeTranscriptWithFallback, pickSubtitleFile } from '@/lib/integrations/youtube-subtitles-ytdlp';

beforeEach(() => {
  fetchTranscript.mockReset();
  resolveBinary.mockReset();
});

describe('timedTextEventsToSegments', () => {
  it('convierte los eventos json3 en segmentos y omite los vacíos', () => {
    const segments = timedTextEventsToSegments([
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: 'Hola' }, { utf8: ' mundo\n' }] },
      { tStartMs: 2000, segs: [{ utf8: '  ' }] },
      { tStartMs: 3000, dDurationMs: 1500, segs: [{ utf8: 'Adiós' }] },
    ]);
    expect(segments).toEqual([
      { index: 0, speaker: null, startSeconds: 0, endSeconds: 2, text: 'Hola mundo' },
      { index: 1, speaker: null, startSeconds: 3, endSeconds: 4.5, text: 'Adiós' },
    ]);
  });
});

describe('pickSubtitleFile', () => {
  it('prefiere el idioma pedido, luego su versión "-orig" y luego cualquier otro', () => {
    expect(pickSubtitleFile(['x.en.json3', 'x.es.json3', 'x.es-orig.json3'], 'es')).toBe('x.es.json3');
    expect(pickSubtitleFile(['x.en.json3', 'x.es-orig.json3'], 'es')).toBe('x.es-orig.json3');
    expect(pickSubtitleFile(['x.fr-orig.json3', 'title.txt'], 'es')).toBe('x.fr-orig.json3');
    expect(pickSubtitleFile(['title.txt'], 'es')).toBeNull();
    expect(pickSubtitleFile(['x.es.json3'], 'es-MX')).toBe('x.es.json3');
  });
});

describe('fetchYoutubeTranscriptWithFallback', () => {
  const OK = { title: 'T', fullText: 'hola', segments: [{ index: 0, speaker: null, startSeconds: 0, endSeconds: 1, text: 'hola' }] };

  it('si la lectura directa funciona, no llama a yt-dlp', async () => {
    fetchTranscript.mockResolvedValue(OK);
    await expect(fetchYoutubeTranscriptWithFallback('abcdefghijk', 'es')).resolves.toEqual(OK);
    expect(resolveBinary).not.toHaveBeenCalled();
  });

  it('si no se pueden leer los subtítulos y no hay yt-dlp, vuelve a lanzar el error original', async () => {
    fetchTranscript.mockRejectedValue(new Error('TRANSCRIPT_FETCH_PARSE_ERROR'));
    resolveBinary.mockResolvedValue(null);
    await expect(fetchYoutubeTranscriptWithFallback('abcdefghijk', 'es')).rejects.toThrow('TRANSCRIPT_FETCH_PARSE_ERROR');
    expect(resolveBinary).toHaveBeenCalledOnce();
  });

  it('los errores que no son "sin subtítulos utilizables" no se reintentan con yt-dlp', async () => {
    fetchTranscript.mockRejectedValue(new Error('YOUTUBE_PAGE_FETCH_ERROR:429'));
    await expect(fetchYoutubeTranscriptWithFallback('abcdefghijk', 'es')).rejects.toThrow('YOUTUBE_PAGE_FETCH_ERROR:429');
    expect(resolveBinary).not.toHaveBeenCalled();
  });
});
