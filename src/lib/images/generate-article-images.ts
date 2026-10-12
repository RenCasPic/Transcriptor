import type { ArticleNode } from '@/lib/validations/article';
import type { ImagePlanInput } from '@/lib/ai/provider';
import {
  ImageGenerationError,
  imageErrorMessageEs,
  type GeneratedImageFile,
  type ImageErrorCode,
} from '@/lib/ai/images/openai-image';
import {
  extractArticleSections,
  fallbackImagePlan,
  finalizeImagePrompt,
  inlineImageCount,
  type ImagePlan,
} from './plan';
import type { InlineImageInsert } from './insert-images';

/** Cuántas imágenes se generan a la vez como máximo. */
export const IMAGE_CONCURRENCY = 3;
/** Tiempo máximo de una sola imagen (ms). */
const PER_IMAGE_TIMEOUT_MS = 110_000;
/** Si queda menos que esto del plazo, ya no se empieza otra imagen. */
const MIN_REMAINING_MS = 8_000;

export type ImageJobMode = 'cover' | 'cover_and_inline';

export interface ImageFailure {
  kind: 'cover' | 'inline';
  /** Bloque (H2) de la sección afectada, para enlazar la alerta. */
  blockId: string | null;
  code: ImageErrorCode | 'UNKNOWN';
  /** Mensaje listo para mostrar en el panel de alertas (es). */
  message: string;
}

export interface GeneratedCover {
  url: string;
  alt: string;
  prompt: string;
}

export interface ArticleImagesResult {
  cover: GeneratedCover | null;
  inline: InlineImageInsert[];
  failures: ImageFailure[];
}

/** Dependencias externas (inyectables para tests). */
export interface ImageDeps {
  plan(input: ImagePlanInput): Promise<ImagePlan>;
  generate(prompt: string, options: { timeoutMs: number }): Promise<GeneratedImageFile>;
  upload(file: GeneratedImageFile): Promise<{ url: string }>;
}

export interface GenerateArticleImagesParams {
  title: string;
  excerpt: string;
  language: string;
  nodes: ArticleNode[];
  mode: ImageJobMode;
  deps: ImageDeps;
  concurrency?: number;
  /** Instante (epoch ms) a partir del cual ya no se empiezan/esperan imágenes. */
  deadlineAt?: number;
  now?: () => number;
}

interface Job {
  kind: 'cover' | 'inline';
  blockId: string | null;
  label: string;
  description: string;
  alt: string;
}

/** Códigos que afectan a TODAS las imágenes: no tiene sentido seguir intentando. */
const FATAL_CODES = new Set<string>(['NOT_CONFIGURED', 'INSUFFICIENT_CREDITS', 'VERIFICATION_REQUIRED']);

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function codeOf(error: unknown): ImageErrorCode | 'UNKNOWN' {
  return error instanceof ImageGenerationError ? error.code : 'UNKNOWN';
}

/**
 * Genera la portada y las imágenes de las secciones. NUNCA lanza: cualquier
 * fallo (planificación, generación, subida) se registra como `ImageFailure` y
 * el resto de imágenes y el artículo siguen adelante.
 *
 * 1) La IA de texto escribe la descripción visual de cada imagen a partir del
 *    contenido real de su sección (si falla, se usa un plan mecánico).
 * 2) Se generan con concurrencia limitada y se suben a Storage.
 */
export async function generateArticleImages(params: GenerateArticleImagesParams): Promise<ArticleImagesResult> {
  const now = params.now ?? Date.now;
  const result: ArticleImagesResult = { cover: null, inline: [], failures: [] };

  try {
    const sections = extractArticleSections(params.nodes);
    const includeCover = true;
    const inlineCount = params.mode === 'cover_and_inline' ? inlineImageCount(sections.length) : 0;
    const planInput: ImagePlanInput = {
      title: params.title,
      excerpt: params.excerpt,
      language: params.language,
      sections,
      inlineCount,
      includeCover,
    };

    let plan: ImagePlan;
    try {
      plan = await params.deps.plan(planInput);
    } catch (error) {
      console.error('[images] No se pudo planificar con la IA; se usa el plan básico:', error);
      plan = fallbackImagePlan({ title: params.title, excerpt: params.excerpt, sections, includeCover, inlineCount });
    }

    const jobs: Job[] = [];
    if (plan.cover) {
      jobs.push({ kind: 'cover', blockId: null, label: 'portada', description: plan.cover.prompt, alt: plan.cover.alt });
    }
    for (const item of plan.inline) {
      const section = sections[item.sectionIndex];
      if (!section) continue;
      jobs.push({
        kind: 'inline',
        blockId: section.blockId,
        label: `la sección «${section.heading}»`,
        description: item.prompt,
        alt: item.alt,
      });
    }

    let fatal: ImageErrorCode | null = null;

    const outcomes = await mapWithConcurrency(jobs, params.concurrency ?? IMAGE_CONCURRENCY, async (job) => {
      if (fatal) return { job, error: new ImageGenerationError(fatal) };
      const remaining = params.deadlineAt === undefined ? Infinity : params.deadlineAt - now();
      if (remaining < MIN_REMAINING_MS) return { job, error: new ImageGenerationError('TIMEOUT') };

      try {
        const file = await params.deps.generate(finalizeImagePrompt(job.description), {
          timeoutMs: Math.min(PER_IMAGE_TIMEOUT_MS, remaining),
        });
        const { url } = await params.deps.upload(file);
        return { job, url };
      } catch (error) {
        const code = codeOf(error);
        if (code !== 'UNKNOWN' && FATAL_CODES.has(code)) fatal = code;
        return { job, error };
      }
    });

    const fatalFailures: ImageFailure[] = [];
    for (const outcome of outcomes) {
      const { job } = outcome;
      if ('url' in outcome && outcome.url) {
        if (job.kind === 'cover') {
          result.cover = { url: outcome.url, alt: job.alt, prompt: job.description };
        } else if (job.blockId) {
          result.inline.push({ afterBlockId: job.blockId, src: outcome.url, alt: job.alt, prompt: job.description });
        }
        continue;
      }

      const code = codeOf(outcome.error);
      console.error(`[images] Falló la imagen de ${job.label}:`, outcome.error instanceof Error ? outcome.error.message : outcome.error);
      const failure: ImageFailure = {
        kind: job.kind,
        blockId: job.blockId,
        code,
        message: `No se pudo generar la imagen de ${job.label}. ${
          code === 'UNKNOWN' ? imageErrorMessageEs('FAILED') : imageErrorMessageEs(code)
        }`,
      };
      // Un error que afecta a todas (sin créditos, sin clave) se informa una sola vez.
      if (code !== 'UNKNOWN' && FATAL_CODES.has(code)) fatalFailures.push(failure);
      else result.failures.push(failure);
    }
    if (fatalFailures.length > 0) {
      const first = fatalFailures[0]!;
      result.failures.unshift({
        kind: first.kind,
        blockId: null,
        code: first.code,
        message: `No se generaron las imágenes del artículo. ${imageErrorMessageEs(first.code as ImageErrorCode)}`,
      });
    }
  } catch (error) {
    console.error('[images] Error inesperado al generar las imágenes:', error);
    result.failures.push({
      kind: 'inline',
      blockId: null,
      code: 'UNKNOWN',
      message: `No se pudieron generar las imágenes del artículo. ${imageErrorMessageEs('FAILED')}`,
    });
  }

  return result;
}
