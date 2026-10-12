import { describe, expect, it, vi } from 'vitest';
import type { ArticleNode } from '@/lib/validations/article';
import type { Json } from '@/lib/types/database';
import {
  articleNodesToProseMirrorJson,
  proseMirrorJsonToHtml,
  proseMirrorJsonToMarkdown,
  proseMirrorJsonToPlainText,
} from '@/lib/content/article-transform';
import { insertImagesIntoContent } from '@/lib/images/insert-images';
import {
  extractArticleSections,
  fallbackImagePlan,
  finalizeImagePrompt,
  inlineImageCount,
  normalizeImagePlan,
  pickEvenlySpaced,
} from '@/lib/images/plan';
import { generateArticleImages, type ImageDeps } from '@/lib/images/generate-article-images';
import { ImageGenerationError, classifyImageHttpError } from '@/lib/ai/images/openai-image';
import { getImageConfig, isImageGenerationConfigured } from '@/lib/ai/images/config';

function nodes(sectionCount: number): ArticleNode[] {
  const out: ArticleNode[] = [];
  for (let i = 0; i < sectionCount; i++) {
    out.push({ id: `s${i}-h`, type: 'heading', level: 2, text: `Sección ${i}`, sourceSegmentIds: [] });
    out.push({ id: `s${i}-b0`, type: 'paragraph', text: `Texto de la sección ${i}.`, sourceSegmentIds: [] });
  }
  return out;
}

const FILE = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/webp', extension: 'webp' };

function deps(over: Partial<ImageDeps> = {}): ImageDeps {
  let n = 0;
  return {
    plan: async (input) =>
      fallbackImagePlan({
        title: input.title,
        excerpt: input.excerpt,
        sections: input.sections,
        includeCover: input.includeCover,
        inlineCount: input.inlineCount,
      }),
    generate: async () => FILE,
    upload: async () => ({ url: `https://cdn.example.com/img-${++n}.webp` }),
    ...over,
  };
}

const BASE = { title: 'Mi artículo', excerpt: 'Resumen', language: 'es' };

describe('insertImagesIntoContent', () => {
  const doc = articleNodesToProseMirrorJson(nodes(3), []);

  it('inserta la imagen justo después del H2 de su sección', () => {
    const { doc: next, inserted, missing } = insertImagesIntoContent(doc, [
      { afterBlockId: 's1-h', src: 'https://cdn.example.com/a.webp', alt: 'Alt A', prompt: 'p' },
    ]);
    const blocks = (next as { content: Array<{ type: string; attrs?: Record<string, unknown> }> }).content;
    const headingIndex = blocks.findIndex((b) => b.attrs?.blockId === 's1-h');
    expect(inserted).toBe(1);
    expect(missing).toEqual([]);
    expect(blocks[headingIndex + 1]).toMatchObject({
      type: 'image',
      attrs: { src: 'https://cdn.example.com/a.webp', alt: 'Alt A', prompt: 'p' },
    });
    // El resto del documento queda intacto y el original no se muta.
    expect(blocks).toHaveLength(7);
    expect((doc as { content: unknown[] }).content).toHaveLength(6);
  });

  it('no inserta (ni falla) cuando el bloque no existe', () => {
    const { doc: next, inserted, missing } = insertImagesIntoContent(doc, [
      { afterBlockId: 'no-existe', src: 'https://cdn.example.com/a.webp', alt: 'x' },
    ]);
    expect(inserted).toBe(0);
    expect(missing).toEqual(['no-existe']);
    expect((next as { content: unknown[] }).content).toHaveLength(6);
  });

  it('el HTML y el Markdown incluyen la imagen con su alt; el texto plano no', () => {
    const { doc: next } = insertImagesIntoContent(doc, [
      { afterBlockId: 's0-h', src: 'https://cdn.example.com/a.webp', alt: 'Una [foto] "bonita"' },
    ]);
    expect(proseMirrorJsonToHtml(next)).toContain('<img src="https://cdn.example.com/a.webp" alt="Una [foto] &quot;bonita&quot;"');
    expect(proseMirrorJsonToMarkdown(next)).toContain('![Una foto "bonita"](https://cdn.example.com/a.webp)');
    expect(proseMirrorJsonToPlainText(next)).not.toContain('cdn.example.com');
  });

  it('ignora imágenes con un src que no es http(s)', () => {
    const bad = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'x' } }, { type: 'paragraph', content: [] }],
    } as Json;
    expect(proseMirrorJsonToHtml(bad)).not.toContain('javascript');
    expect(proseMirrorJsonToMarkdown(bad)).not.toContain('javascript');
  });
});

describe('plan de imágenes', () => {
  it('una imagen cada 2-3 secciones H2, máximo 4', () => {
    expect(inlineImageCount(0)).toBe(0);
    expect(inlineImageCount(1)).toBe(0);
    expect(inlineImageCount(2)).toBe(1);
    expect(inlineImageCount(5)).toBe(2);
    expect(inlineImageCount(7)).toBe(3);
    expect(inlineImageCount(10)).toBe(4);
    expect(inlineImageCount(30)).toBe(4);
  });

  it('reparte las secciones de forma pareja y sin repetir', () => {
    expect(pickEvenlySpaced(10, 4)).toEqual([1, 3, 6, 8]);
    expect(pickEvenlySpaced(3, 4)).toHaveLength(3);
    expect(pickEvenlySpaced(0, 2)).toEqual([]);
  });

  it('extrae las secciones H2 con su texto', () => {
    const sections = extractArticleSections(nodes(3));
    expect(sections.map((s) => s.blockId)).toEqual(['s0-h', 's1-h', 's2-h']);
    expect(sections[1]).toMatchObject({ index: 1, heading: 'Sección 1', text: 'Texto de la sección 1.' });
  });

  it('normaliza el plan de la IA: descarta secciones inválidas o repetidas y completa lo que falta', () => {
    const sections = extractArticleSections(nodes(6));
    const plan = normalizeImagePlan(
      {
        cover: { prompt: 'cover prompt', alt: 'cover alt' },
        images: [
          { sectionIndex: 99, prompt: 'fuera de rango', alt: 'x' },
          { sectionIndex: 2, prompt: 'valida', alt: 'a' },
          { sectionIndex: 2, prompt: 'repetida', alt: 'b' },
        ],
      },
      { title: 'T', excerpt: 'E', sections, includeCover: true, inlineCount: 2 },
    );
    expect(plan.cover?.prompt).toBe('cover prompt');
    expect(plan.inline).toHaveLength(2);
    expect(new Set(plan.inline.map((i) => i.sectionIndex)).size).toBe(2);
    expect(plan.inline.find((i) => i.sectionIndex === 2)?.prompt).toBe('valida');
  });

  it('el prompt final siempre prohíbe texto y logos', () => {
    const prompt = finalizeImagePrompt('A mountain lake', 'muted teal palette');
    expect(prompt).toContain('A mountain lake');
    expect(prompt).toContain('muted teal palette');
    expect(prompt).toMatch(/NO text, letters/);
  });
});

describe('generateArticleImages — fallback cuando una imagen falla', () => {
  it('si una imagen falla, las demás se generan y el fallo queda registrado (no lanza)', async () => {
    let call = 0;
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(6),
      mode: 'cover_and_inline',
      deps: deps({
        generate: async () => {
          call++;
          if (call === 2) throw new ImageGenerationError('CONTENT_REJECTED');
          return FILE;
        },
      }),
    });

    // portada + 2 imágenes de sección (6 secciones), una de ellas falla.
    expect(result.cover).not.toBeNull();
    expect(result.inline).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({ code: 'CONTENT_REJECTED' });
    expect(result.failures[0]!.message).toMatch(/rechaz/i);
  });

  it('si falla la portada, las imágenes de sección siguen (y el pipeline usará Pexels)', async () => {
    let call = 0;
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(6),
      mode: 'cover_and_inline',
      deps: deps({
        generate: async () => {
          call++;
          if (call === 1) throw new ImageGenerationError('FAILED');
          return FILE;
        },
      }),
    });
    expect(result.cover).toBeNull();
    expect(result.inline.length).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.kind === 'cover')).toBe(true);
  });

  it('un error global (sin créditos) se informa una sola vez y no se sigue intentando', async () => {
    const generate = vi.fn(async () => {
      throw new ImageGenerationError('INSUFFICIENT_CREDITS');
    });
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(10),
      mode: 'cover_and_inline',
      concurrency: 1,
      deps: deps({ generate }),
    });
    expect(result.cover).toBeNull();
    expect(result.inline).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.code).toBe('INSUFFICIENT_CREDITS');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('si la planificación con IA falla, usa el plan básico y genera igualmente', async () => {
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(6),
      mode: 'cover_and_inline',
      deps: deps({
        plan: async () => {
          throw new Error('AI_PROVIDER_INVALID_IMAGE_PLAN');
        },
      }),
    });
    expect(result.cover).not.toBeNull();
    expect(result.inline.length).toBeGreaterThan(0);
    expect(result.failures).toEqual([]);
  });

  it('si falla la subida a Storage, es una falla de imagen, no del artículo', async () => {
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(2),
      mode: 'cover',
      deps: deps({
        upload: async () => {
          throw new Error('IMAGE_UPLOAD_FAILED:bucket not found');
        },
      }),
    });
    expect(result.cover).toBeNull();
    expect(result.failures).toHaveLength(1);
  });

  it('modo "solo portada" no genera imágenes de sección', async () => {
    const generate = vi.fn(async () => FILE);
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(8),
      mode: 'cover',
      deps: deps({ generate }),
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.inline).toEqual([]);
    expect(result.cover).not.toBeNull();
  });

  it('respeta la concurrencia máxima de 3', async () => {
    let running = 0;
    let peak = 0;
    await generateArticleImages({
      ...BASE,
      nodes: nodes(12),
      mode: 'cover_and_inline',
      deps: deps({
        generate: async () => {
          running++;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 5));
          running--;
          return FILE;
        },
      }),
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('con el plazo agotado no empieza imágenes nuevas (TIMEOUT) y no lanza', async () => {
    const generate = vi.fn(async () => FILE);
    const result = await generateArticleImages({
      ...BASE,
      nodes: nodes(6),
      mode: 'cover_and_inline',
      deadlineAt: 1000,
      now: () => 999,
      deps: deps({ generate }),
    });
    expect(generate).not.toHaveBeenCalled();
    expect(result.cover).toBeNull();
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.every((f) => f.code === 'TIMEOUT')).toBe(true);
  });
});

describe('configuración y errores de OpenAI', () => {
  it('usa valores por defecto y respeta AI_IMAGE_*', () => {
    expect(getImageConfig({})).toEqual({ model: 'gpt-image-2.5-flare', quality: 'medium', size: '1536x1024' });
    expect(getImageConfig({ AI_IMAGE_MODEL: 'otro', AI_IMAGE_QUALITY: 'HIGH', AI_IMAGE_SIZE: '1024x1024' })).toEqual({
      model: 'otro',
      quality: 'high',
      size: '1024x1024',
    });
    expect(getImageConfig({ AI_IMAGE_QUALITY: 'ultra', AI_IMAGE_SIZE: 'grande' })).toMatchObject({
      quality: 'medium',
      size: '1536x1024',
    });
  });

  it('solo se considera configurado con AI_API_KEY y proveedor OpenAI', () => {
    expect(isImageGenerationConfigured({})).toBe(false);
    expect(isImageGenerationConfigured({ AI_API_KEY: 'sk-x' })).toBe(true);
    expect(isImageGenerationConfigured({ AI_API_KEY: 'sk-x', AI_PROVIDER: 'anthropic' })).toBe(false);
  });

  it('clasifica los errores de OpenAI', () => {
    expect(classifyImageHttpError(400, '{"error":{"code":"moderation_blocked"}}')).toBe('CONTENT_REJECTED');
    expect(classifyImageHttpError(429, '{"error":{"code":"insufficient_quota"}}')).toBe('INSUFFICIENT_CREDITS');
    expect(classifyImageHttpError(429, 'rate limit')).toBe('RATE_LIMITED');
    expect(classifyImageHttpError(401, 'bad key')).toBe('NOT_CONFIGURED');
    expect(classifyImageHttpError(403, 'Your organization must be verified to use gpt-image')).toBe(
      'VERIFICATION_REQUIRED',
    );
    expect(classifyImageHttpError(500, '')).toBe('FAILED');
  });
});
