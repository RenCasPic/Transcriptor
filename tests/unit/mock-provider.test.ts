import { describe, expect, it } from 'vitest';
import { MockContentGenerationProvider } from '@/lib/ai/providers/mock-provider';
import type { GenerateArticleInput } from '@/lib/ai/provider';

function buildInput(overrides: Partial<GenerateArticleInput['project']> = {}): GenerateArticleInput {
  return {
    transcript: {
      language: 'es',
      fullText: '',
      segments: [
        { id: 'seg-1', index: 0, speaker: 'Ana', startSeconds: 0, endSeconds: 5, text: 'Hoy hablamos de contenidos.' },
        { id: 'seg-2', index: 1, speaker: 'Ana', startSeconds: 5, endSeconds: 10, text: 'En 2023 crecimos un 40 por ciento.' },
        { id: 'seg-3', index: 2, speaker: 'Ana', startSeconds: 10, endSeconds: 15, text: 'El proceso tiene tres pasos clave.' },
        { id: 'seg-4', index: 3, speaker: 'Ana', startSeconds: 15, endSeconds: 20, text: 'Gracias por escuchar el episodio.' },
      ],
    },
    project: {
      contentType: 'guide',
      audience: 'Marketers',
      tone: 'professional',
      language: 'es',
      primaryKeyword: null,
      objective: null,
      callToAction: null,
      provisionalTitle: null,
      ...overrides,
    },
  };
}

describe('MockContentGenerationProvider', () => {
  const provider = new MockContentGenerationProvider();

  it('genera un artículo cuyo contenido proviene únicamente de la transcripción', async () => {
    const article = await provider.generateArticle(buildInput());
    const allText = article.content.map((n) => n.text ?? '').join(' ');

    // No debe contener texto que no provenga de los segmentos originales.
    expect(allText).toContain('contenidos');
    expect(article.content.length).toBeGreaterThan(0);
    expect(article.seo.slug).not.toContain(' ');
  });

  it('marca con una alerta los bloques que contienen cifras', async () => {
    const article = await provider.generateArticle(buildInput());
    const numberWarnings = article.warnings.filter((w) => w.type === 'number_verification');
    expect(numberWarnings.length).toBeGreaterThan(0);
  });

  it('conserva sourceSegmentIds válidos apuntando a segmentos reales', async () => {
    const article = await provider.generateArticle(buildInput());
    const validIds = new Set(['seg-1', 'seg-2', 'seg-3', 'seg-4']);
    article.content.forEach((node) => {
      node.sourceSegmentIds.forEach((id) => expect(validIds.has(id)).toBe(true));
    });
  });

  it('rewriteSection "shorten" produce un texto igual o más corto', async () => {
    const original = 'Primera frase. Segunda frase. Tercera frase.';
    const result = await provider.rewriteSection({
      text: original,
      instruction: 'shorten',
      tone: 'professional',
      language: 'es',
      audience: null,
      primaryKeyword: null,
    });
    expect(result.length).toBeLessThanOrEqual(original.length);
  });

  it('rewriteSection "convert_to_list" produce líneas con guiones', async () => {
    const result = await provider.rewriteSection({
      text: 'Primera idea. Segunda idea.',
      instruction: 'convert_to_list',
      tone: 'professional',
      language: 'es',
      audience: null,
      primaryKeyword: null,
    });
    expect(result).toContain('- ');
  });
});
