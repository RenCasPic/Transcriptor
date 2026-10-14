import { z } from 'zod';
import type { ArticleNode } from '@/lib/validations/article';
import { MAX_INLINE_IMAGES } from '@/lib/ai/images/cost';

/** Una sección H2 del artículo, candidata a llevar una imagen. */
export interface ArticleSection {
  index: number;
  /** `attrs.blockId` del H2: la imagen se inserta justo después de este bloque. */
  blockId: string;
  heading: string;
  /** Resumen del texto de la sección (recortado) para que la IA describa la imagen. */
  text: string;
}

export interface ImagePlanItem {
  prompt: string;
  alt: string;
}

export interface InlineImagePlanItem extends ImagePlanItem {
  sectionIndex: number;
}

export interface ImagePlan {
  cover: ImagePlanItem | null;
  inline: InlineImagePlanItem[];
}

/** Forma que se le pide a la IA de texto (se valida con zod y se normaliza). */
export const ImagePlanRawSchema = z.object({
  cover: z.object({ prompt: z.string().min(5), alt: z.string().min(1) }).nullish(),
  images: z
    .array(z.object({ sectionIndex: z.number().int(), prompt: z.string().min(5), alt: z.string().min(1) }))
    .default([]),
});
export type ImagePlanRaw = z.infer<typeof ImagePlanRawSchema>;

export const ImagePromptSuggestionSchema = z.object({
  prompt: z.string().min(5),
  alt: z.string().min(1),
});

const SECTION_TEXT_MAX_CHARS = 600;

/** Reglas visuales que se añaden SIEMPRE al prompt de cada imagen (estilo coherente, sin texto). */
export const IMAGE_STYLE_RULES =
  'Editorial photography style, natural realistic lighting, shallow depth of field, cohesive muted color palette, ' +
  'clean uncluttered composition, landscape orientation. ' +
  'ABSOLUTELY NO text, letters, numbers, words, captions, logos, brand marks, watermarks, signs or user-interface screenshots anywhere in the image.';

/** ¿El artículo está en español? (los textos de respaldo y la etiqueta del estilo salen en el idioma del artículo). */
export function isSpanish(language: string | null | undefined): boolean {
  return (language ?? '').toLowerCase().startsWith('es');
}

/** Frase que une la descripción de una imagen con el estilo visual común, en el idioma del artículo. */
export function sharedStyleSuffix(style: string, language: string | null | undefined): string {
  const clean = style.trim().replace(/\.$/, '');
  return isSpanish(language) ? ` Estilo visual común: ${clean}.` : ` Shared visual style: ${clean}.`;
}

/** Prompt final enviado al modelo de imágenes: la descripción + las reglas de estilo. */
export function finalizeImagePrompt(description: string, style?: string): string {
  const parts = [description.trim().replace(/\s+/g, ' ')];
  if (style && style.trim()) parts.push(`Shared visual style for the whole article: ${style.trim()}.`);
  parts.push(IMAGE_STYLE_RULES);
  return parts.join(' ');
}

function nodeText(node: ArticleNode): string {
  if (node.type === 'list') return (node.items ?? []).join('. ');
  return node.text ?? '';
}

/** Secciones H2 del artículo generado (sin la FAQ, que se añade aparte) con un resumen de su texto. */
export function extractArticleSections(nodes: ArticleNode[]): ArticleSection[] {
  const sections: ArticleSection[] = [];
  let current: { section: ArticleSection; chunks: string[] } | null = null;

  const close = () => {
    if (!current) return;
    current.section.text = current.chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, SECTION_TEXT_MAX_CHARS);
    sections.push(current.section);
  };

  for (const node of nodes) {
    const isSectionHeading = node.type === 'heading' && (node.level ?? 2) === 2;
    if (isSectionHeading) {
      close();
      current = {
        section: { index: sections.length, blockId: node.id, heading: node.text ?? '', text: '' },
        chunks: [],
      };
    } else if (current) {
      current.chunks.push(nodeText(node));
    }
  }
  close();
  return sections;
}

/** Cuántas imágenes dentro del artículo: una cada 2-3 secciones H2, máximo 4. */
export function inlineImageCount(sectionCount: number): number {
  if (sectionCount < 2) return 0;
  return Math.min(MAX_INLINE_IMAGES, Math.max(1, Math.round(sectionCount / 2.5)));
}

/** `n` índices repartidos de forma pareja entre `total` secciones. */
export function pickEvenlySpaced(total: number, n: number): number[] {
  if (n <= 0 || total <= 0) return [];
  const count = Math.min(n, total);
  const picked = new Set<number>();
  for (let i = 0; i < count; i++) picked.add(Math.min(total - 1, Math.floor(((i + 0.5) * total) / count)));
  // Por si el redondeo repitiera alguno, se completa con los libres.
  for (let i = 0; picked.size < count && i < total; i++) picked.add(i);
  return [...picked].sort((a, b) => a - b);
}

/**
 * Plan de imágenes mecánico (sin IA de texto): se usa cuando la planificación
 * con la IA falla o devuelve algo inválido, para que las imágenes se generen
 * igualmente a partir de los títulos reales del artículo.
 */
export function fallbackImagePlan(params: {
  title: string;
  excerpt: string;
  sections: ArticleSection[];
  includeCover: boolean;
  inlineCount: number;
  /** Idioma del artículo: la descripción de respaldo se escribe en él. */
  language?: string;
}): ImagePlan {
  const { title, excerpt, sections, includeCover, inlineCount } = params;
  const es = isSpanish(params.language);
  const coverLead = es ? 'Una fotografía que represente visualmente el tema:' : 'A photograph that visually represents the topic:';
  const sectionLead = es ? 'Una fotografía que represente visualmente:' : 'A photograph that visually represents:';
  const cover = includeCover ? { prompt: `${coverLead} ${title}. ${excerpt}`.slice(0, 600), alt: title } : null;
  const inline = pickEvenlySpaced(sections.length, inlineCount).map((sectionIndex) => {
    const section = sections[sectionIndex]!;
    return {
      sectionIndex,
      prompt: `${sectionLead} ${section.heading}. ${section.text}`.slice(0, 600),
      alt: section.heading || title,
    };
  });
  return { cover, inline };
}

/**
 * Valida y normaliza el plan de la IA: descarta secciones inexistentes o
 * repetidas, respeta el máximo y completa lo que falte con el plan mecánico.
 */
export function normalizeImagePlan(
  raw: ImagePlanRaw | null,
  params: {
    title: string;
    excerpt: string;
    sections: ArticleSection[];
    includeCover: boolean;
    inlineCount: number;
    language?: string;
  },
): ImagePlan {
  const fallback = fallbackImagePlan(params);
  if (!raw) return fallback;

  const seen = new Set<number>();
  const inline: InlineImagePlanItem[] = [];
  for (const item of raw.images) {
    if (inline.length >= params.inlineCount) break;
    if (item.sectionIndex < 0 || item.sectionIndex >= params.sections.length) continue;
    if (seen.has(item.sectionIndex)) continue;
    seen.add(item.sectionIndex);
    inline.push({ sectionIndex: item.sectionIndex, prompt: item.prompt, alt: item.alt });
  }
  // Si la IA devolvió menos de las pedidas, se completan con secciones repartidas.
  for (const extra of fallback.inline) {
    if (inline.length >= params.inlineCount) break;
    if (!seen.has(extra.sectionIndex)) {
      seen.add(extra.sectionIndex);
      inline.push(extra);
    }
  }
  inline.sort((a, b) => a.sectionIndex - b.sectionIndex);

  return {
    cover: params.includeCover ? (raw.cover ?? fallback.cover) : null,
    inline,
  };
}
