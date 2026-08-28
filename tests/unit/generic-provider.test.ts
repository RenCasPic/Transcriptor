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
