import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenericContentGenerationProvider } from '@/lib/ai/providers/generic-provider';
import type { GenerateArticleInput } from '@/lib/ai/provider';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SEG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SEG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const INPUT: GenerateArticleInput = {
  transcript: {
    fullText: 'hola\n\nmundo',
    language: 'es',
    segments: [
      { id: SEG_A, index: 0, speaker: null, startSeconds: 0, endSeconds: 2, text: 'hola' },
      { id: SEG_B, index: 1, speaker: null, startSeconds: 2, endSeconds: 4, text: 'mundo' },
    ],
  },
  project: {
    contentType: 'guide',
    audience: null,
    tone: 'professional',
    language: 'es',
    primaryKeyword: null,
    objective: null,
    callToAction: null,
    provisionalTitle: null,
  },
};

function mockArticleJson(sourceRefs: string[]): string {
  return JSON.stringify({
    title: 'T',
    excerpt: 'E',
    content: [{ id: 'b1', type: 'paragraph', text: 'p', sourceSegmentIds: sourceRefs }],
    faq: [{ question: 'q', answer: 'a', sourceSegmentIds: ['s1'] }],
    seo: { title: 'T', slug: 't', metaDescription: 'm', secondaryKeywords: [] },
    warnings: [],
  });
}

describe('GenericContentGenerationProvider.generateArticle — remapeo de segmentos', () => {
  it('traduce etiquetas "s{index}" del modelo a los UUID reales de los segmentos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        clone() {
          return this;
        },
        text: async () => '',
        json: async () => ({ choices: [{ message: { content: mockArticleJson(['s0', 's1']) } }] }),
      })),
    );

    const article = await new GenericContentGenerationProvider('groq', 'k').generateArticle(INPUT);
    expect(article.content[0]!.sourceSegmentIds).toEqual([SEG_A, SEG_B]);
    expect(article.faq[0]!.sourceSegmentIds).toEqual([SEG_B]);
  });

  it('acepta también el UUID directo y descarta referencias inválidas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        clone() {
          return this;
        },
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: mockArticleJson([SEG_A, 's99', 'basura']) } }],
        }),
      })),
    );

    const article = await new GenericContentGenerationProvider('groq', 'k').generateArticle(INPUT);
    expect(article.content[0]!.sourceSegmentIds).toEqual([SEG_A]);
  });

  it('reintenta ante 429 y respeta el "try again in Xs" del cuerpo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers(),
        clone() {
          return this;
        },
        text: async () => 'Rate limit reached ... try again in 0.01s',
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        clone() {
          return this;
        },
        text: async () => '',
        json: async () => ({ choices: [{ message: { content: mockArticleJson(['s0']) } }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const article = await new GenericContentGenerationProvider('groq', 'k').generateArticle(INPUT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(article.content[0]!.sourceSegmentIds).toEqual([SEG_A]);
  });

  it('NO reintenta ante 413 (petición demasiado grande)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      headers: new Headers(),
      clone() {
        return this;
      },
      text: async () => 'Request too large',
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new GenericContentGenerationProvider('groq', 'k').generateArticle(INPUT)).rejects.toThrow(
      /AI_PROVIDER_HTTP_ERROR:413/,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

function jsonResponse(status: number, body: unknown, text = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    clone() {
      return this;
    },
    text: async () => text,
    json: async () => body,
  };
}

describe('GenericContentGenerationProvider — OpenAI + robustez', () => {
  it('OpenAI: llama a la API correcta, con Bearer y modo JSON', async () => {
    let seen: { url: string; body: Record<string, unknown>; auth: string } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        seen = {
          url,
          body: JSON.parse(init.body as string),
          auth: ((init.headers ?? {}) as Record<string, string>).authorization ?? '',
        };
        return jsonResponse(200, { choices: [{ message: { content: mockArticleJson(['s0']) } }] });
      }),
    );

    await new GenericContentGenerationProvider('openai', 'sk-abc', 'gpt-4o-mini').generateArticle(INPUT);
    expect(seen!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(seen!.auth).toBe('Bearer sk-abc');
    expect(seen!.body.model).toBe('gpt-4o-mini');
    expect(seen!.body.response_format).toEqual({ type: 'json_object' });
  });

  it('rechaza antes de llamar si el prompt supera el tope de tokens de entrada (default ~110k)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // ~40 segmentos de 12k chars = ~480k chars > 110000 tokens * 4 chars/token.
    const bigInput: GenerateArticleInput = {
      ...INPUT,
      transcript: {
        ...INPUT.transcript,
        segments: Array.from({ length: 40 }, (_, i) => ({
          id: `${i}`.padStart(8, '0') + '-0000-4000-8000-000000000000',
          index: i,
          speaker: null,
          startSeconds: i,
          endSeconds: i + 1,
          text: 'x'.repeat(12_000),
        })),
      },
    };

    await expect(
      new GenericContentGenerationProvider('openai', 'sk-x').generateArticle(bigInput),
    ).rejects.toThrow('AI_TRANSCRIPT_TOO_LONG');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('NO reintenta un 429 de cuota agotada (insufficient_quota)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, {}, 'You exceeded your current quota (insufficient_quota)'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new GenericContentGenerationProvider('openai', 'sk-x').generateArticle(INPUT),
    ).rejects.toThrow(/AI_PROVIDER_HTTP_ERROR:429/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reintenta ante 500 y termina bien', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, {}, 'internal error'))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [{ message: { content: mockArticleJson(['s0']) } }] }));
    vi.stubGlobal('fetch', fetchMock);

    const article = await new GenericContentGenerationProvider('openai', 'sk-x').generateArticle(INPUT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(article.content[0]!.sourceSegmentIds).toEqual([SEG_A]);
  });

  it('propaga el 401 con el cuerpo para que se clasifique como error de auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, {}, '{"error":{"code":"invalid_api_key"}}')),
    );
    await expect(
      new GenericContentGenerationProvider('openai', 'sk-bad').generateArticle(INPUT),
    ).rejects.toThrow(/AI_PROVIDER_HTTP_ERROR:401:.*invalid_api_key/);
  });
});
