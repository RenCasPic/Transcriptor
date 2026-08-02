import { describe, expect, it } from 'vitest';
import { GeneratedArticleSchema } from '@/lib/validations/article';

const VALID_ARTICLE = {
  title: 'Cómo estructurar un plan de contenidos',
  excerpt: 'Un resumen breve del artículo.',
  content: [
    { id: 'intro', type: 'paragraph', text: 'Introducción del artículo.', sourceSegmentIds: ['seg-1'] },
    { id: 'h1', type: 'heading', level: 2, text: 'Primer paso', sourceSegmentIds: ['seg-2'] },
  ],
  faq: [{ question: '¿Por qué importa?', answer: 'Porque sí.', sourceSegmentIds: [] }],
  seo: {
    title: 'Cómo estructurar un plan de contenidos',
    slug: 'como-estructurar-un-plan-de-contenidos',
    metaDescription: 'Aprende a estructurar tu plan de contenidos.',
    secondaryKeywords: ['marketing', 'contenidos'],
  },
  warnings: [],
};

describe('GeneratedArticleSchema', () => {
  it('valida una respuesta bien formada del proveedor de IA', () => {
    const result = GeneratedArticleSchema.safeParse(VALID_ARTICLE);
    expect(result.success).toBe(true);
  });

  it('rechaza un artículo sin bloques de contenido', () => {
    const result = GeneratedArticleSchema.safeParse({ ...VALID_ARTICLE, content: [] });
    expect(result.success).toBe(false);
  });

  it('rechaza un tipo de bloque no soportado', () => {
    const result = GeneratedArticleSchema.safeParse({
      ...VALID_ARTICLE,
      content: [{ id: 'x', type: 'table', text: 'no soportado', sourceSegmentIds: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un tipo de alerta desconocido', () => {
    const result = GeneratedArticleSchema.safeParse({
      ...VALID_ARTICLE,
      warnings: [{ blockId: 'h1', type: 'fake_type', message: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  it('aplica valores por defecto a campos opcionales de segmentos fuente', () => {
    const result = GeneratedArticleSchema.safeParse({
      ...VALID_ARTICLE,
      content: [{ id: 'p1', type: 'paragraph', text: 'Texto sin fuentes explícitas' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content[0]!.sourceSegmentIds).toEqual([]);
    }
  });
});
