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

describe('GenericContentGenerationProvider — generación en varias etapas (transcripción larga)', () => {
  const LONG_INPUT: GenerateArticleInput = {
    ...INPUT,
    transcript: {
      ...INPUT.transcript,
      segments: Array.from({ length: 120 }, (_, i) => ({
        id: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
        index: i,
        speaker: 'Ponente',
        startSeconds: i * 10,
        endSeconds: i * 10 + 9,
        text: `Idea número ${i} explicada con cierto detalle y un ejemplo concreto.`,
      })),
    },
  };

  it('extrae notas por bloques, hace esqueleto, redacta cada sección y ensambla con trazabilidad', async () => {
    const counts = { extract: 0, outline: 0, section: 0, meta: 0 };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const prompt = (JSON.parse(init.body as string).messages as Array<{ content: string }>)[1]!.content;
        let content: string;
        if (prompt.includes('Estás procesando un FRAGMENTO')) {
          counts.extract += 1;
          content = JSON.stringify({
            notes: [
              { point: 'Nota A del bloque', sourceSegmentIds: ['s0', 's1'] },
              { point: 'Nota B del bloque', sourceSegmentIds: ['s2'] },
            ],
          });
        } else if (prompt.includes('Diseña el ESQUELETO')) {
          counts.outline += 1;
          content = JSON.stringify({
            title: 'Título del artículo',
            sections: [
              { heading: 'Introducción', noteRefs: [1] },
              { heading: 'Desarrollo', noteRefs: [2, 3] },
            ],
          });
        } else if (prompt.includes('Escribe SOLO la sección')) {
          counts.section += 1;
          content = JSON.stringify({
            blocks: [
              { type: 'paragraph', text: 'Un párrafo desarrollado de la sección con varias frases.' },
              { type: 'paragraph', text: 'Otro párrafo con más detalle.' },
            ],
          });
        } else {
          counts.meta += 1;
          content = JSON.stringify({
            excerpt: 'Extracto del artículo.',
            faq: [{ question: '¿Y?', answer: 'Pues eso.', noteRefs: [1] }],
            seo: { title: 'SEO', slug: 'seo', metaDescription: 'meta', secondaryKeywords: [] },
            warnings: [],
          });
        }
        return jsonResponse(200, { choices: [{ message: { content } }] });
      }),
    );

    const article = await new GenericContentGenerationProvider('openai', 'sk-x').generateArticle(LONG_INPUT);

    expect(counts.extract).toBeGreaterThanOrEqual(2); // 120 segmentos / 45 por bloque = 3 bloques
    expect(counts.outline).toBe(1);
    expect(counts.section).toBe(2); // 2 secciones en el esqueleto
    expect(counts.meta).toBe(1);

    expect(article.title).toBe('Título del artículo');
    expect(article.content.filter((n) => n.type === 'heading')).toHaveLength(2);
    expect(article.content.filter((n) => n.type === 'paragraph').length).toBeGreaterThanOrEqual(4);
    // Trazabilidad: los sourceSegmentIds se calculan de las notas y se mapean a UUID reales.
    const validIds = new Set(LONG_INPUT.transcript.segments.map((s) => s.id));
    expect(article.content.every((n) => n.sourceSegmentIds.every((id) => validIds.has(id)))).toBe(true);
    expect(article.content.every((n) => n.sourceSegmentIds.length > 0)).toBe(true);
    expect(article.faq[0]!.sourceSegmentIds.length).toBeGreaterThan(0);
  });

  it('si una sección falla al parsear, usa un fallback con las notas (no pierde la sección)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const prompt = (JSON.parse(init.body as string).messages as Array<{ content: string }>)[1]!.content;
        let content: string;
        if (prompt.includes('Estás procesando un FRAGMENTO')) {
          content = JSON.stringify({ notes: [{ point: 'Nota', sourceSegmentIds: ['s5'] }] });
        } else if (prompt.includes('Diseña el ESQUELETO')) {
          content = JSON.stringify({ title: 'T', sections: [{ heading: 'Única', noteRefs: [1] }] });
        } else if (prompt.includes('Escribe SOLO la sección')) {
          content = 'esto no es JSON';
        } else {
          content = JSON.stringify({
            excerpt: 'e',
            faq: [],
            seo: { title: 'S', slug: 's', metaDescription: 'm', secondaryKeywords: [] },
            warnings: [],
          });
        }
        return jsonResponse(200, { choices: [{ message: { content } }] });
      }),
    );

    const article = await new GenericContentGenerationProvider('openai', 'sk-x').generateArticle(LONG_INPUT);
    expect(article.content.some((n) => n.type === 'paragraph' && n.text?.includes('Nota'))).toBe(true);
  });
});
