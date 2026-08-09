import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchYoutubeTranscript } from '@/lib/integrations/youtube-transcript';

const HTML_WITH_CAPTIONS = `<html><head><title>Test Video - YouTube</title></head><body><script>var data = {"captionTracks":[{"baseUrl":"https://example.com/timedtext","languageCode":"es","kind":"asr"}]};</script></body></html>`;
const HTML_WITHOUT_CAPTIONS = `<html><head><title>No Captions - YouTube</title></head><body></body></html>`;

function mockFetchSequence(pageHtml: string, timedTextHandler: () => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/watch?v=')) {
        return { ok: true, text: async () => pageHtml } as Response;
      }
      return timedTextHandler();
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchYoutubeTranscript', () => {
  it('lanza NO_CAPTIONS si el video no tiene ninguna pista de subtítulos', async () => {
    mockFetchSequence(HTML_WITHOUT_CAPTIONS, () => {
      throw new Error('no debería llamarse');
    });
    await expect(fetchYoutubeTranscript('dQw4w9WgXcQ', 'es')).rejects.toThrow('NO_CAPTIONS');
  });

  it('lanza TRANSCRIPT_FETCH_PARSE_ERROR si la pista responde 200 con cuerpo no parseable', async () => {
    mockFetchSequence(HTML_WITH_CAPTIONS, () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    }) as unknown as Response);

    await expect(fetchYoutubeTranscript('dQw4w9WgXcQ', 'es')).rejects.toThrow('TRANSCRIPT_FETCH_PARSE_ERROR');
  });

  it('lanza EMPTY_TRANSCRIPT si la pista no trae eventos con texto', async () => {
    mockFetchSequence(HTML_WITH_CAPTIONS, () => ({
      ok: true,
      json: async () => ({ events: [] }),
    }) as unknown as Response);

    await expect(fetchYoutubeTranscript('dQw4w9WgXcQ', 'es')).rejects.toThrow('EMPTY_TRANSCRIPT');
  });

  it('devuelve los segmentos cuando la pista responde con eventos válidos', async () => {
    mockFetchSequence(HTML_WITH_CAPTIONS, () => ({
      ok: true,
      json: async () => ({
        events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hola mundo' }] }],
      }),
    }) as unknown as Response);

    const result = await fetchYoutubeTranscript('dQw4w9WgXcQ', 'es');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe('Hola mundo');
    expect(result.title).toBe('Test Video');
  });
});
