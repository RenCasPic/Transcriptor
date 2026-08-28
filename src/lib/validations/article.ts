import { z } from 'zod';

/**
 * Esquemas Zod para la salida estructurada de los proveedores de generación de IA.
 * Todo proveedor debe producir datos que validen contra `GeneratedArticleSchema`
 * antes de persistirse. Ver `ContentGenerationProvider` en `src/lib/ai/provider.ts`.
 */

export const ArticleNodeTypeSchema = z.enum(['heading', 'paragraph', 'list', 'quote']);

export const ArticleNodeSchema = z.object({
  id: z.string().min(1),
  type: ArticleNodeTypeSchema,
  level: z.union([z.literal(2), z.literal(3)]).optional(),
  ordered: z.boolean().optional(),
  items: z.array(z.string().min(1)).optional(),
  text: z.string().optional(),
  sourceSegmentIds: z.array(z.string()).default([]),
});

export const FaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  sourceSegmentIds: z.array(z.string()).default([]),
});

export const ContentWarningTypeSchema = z.enum([
  'unsupported_claim',
  'number_verification',
  'name_verification',
  'date_verification',
  'possible_hallucination',
  'missing_source',
]);

export const ContentWarningSchema = z.object({
  blockId: z.string().nullable(),
  type: ContentWarningTypeSchema,
  message: z.string().min(1),
});

export const SeoMetadataSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  metaDescription: z.string().min(1),
  primaryKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).default([]),
});

export const GeneratedArticleSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  content: z.array(ArticleNodeSchema).min(1),
  faq: z.array(FaqItemSchema).default([]),
  seo: SeoMetadataSchema,
  warnings: z.array(ContentWarningSchema).default([]),
});

/**
 * Generación en varias etapas para transcripciones largas (ver
 * `GenericContentGenerationProvider`). gpt-4o-mini no desarrolla bien una
 * transcripción larga en una sola llamada, así que:
 *   1. extraer notas por bloques (sin resumir)  -> ExtractedNote
 *   2. agrupar las notas en secciones           -> ArticleOutline
 *   3. redactar CADA sección por separado       -> SectionResult
 *   4. generar excerpt + FAQ + SEO + warnings   -> ArticleMeta
 * Cada sección es una tarea acotada, así que el modelo la desarrolla a fondo;
 * la longitud del artículo acaba siendo proporcional al contenido real.
 */
export const ExtractedNoteSchema = z.object({
  point: z.string().min(1),
  sourceSegmentIds: z.array(z.string()).default([]),
});
export const ExtractionResultSchema = z.object({
  notes: z.array(ExtractedNoteSchema).default([]),
});
export type ExtractedNote = z.infer<typeof ExtractedNoteSchema>;

export const ArticleOutlineSchema = z.object({
  title: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        noteRefs: z.array(z.number().int().positive()).default([]),
      }),
    )
    .min(1),
});
export type ArticleOutline = z.infer<typeof ArticleOutlineSchema>;

export const SectionResultSchema = z.object({
  blocks: z
    .array(
      z.object({
        type: z.enum(['paragraph', 'list', 'quote']),
        level: z.union([z.literal(2), z.literal(3)]).optional(),
        ordered: z.boolean().optional(),
        items: z.array(z.string().min(1)).optional(),
        text: z.string().optional(),
      }),
    )
    .min(1),
});

export const ArticleMetaSchema = z.object({
  excerpt: z.string().min(1),
  faq: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        noteRefs: z.array(z.number().int().positive()).default([]),
      }),
    )
    .default([]),
  seo: SeoMetadataSchema,
  warnings: z.array(ContentWarningSchema).default([]),
});

export type ArticleNode = z.infer<typeof ArticleNodeSchema>;
export type FaqItem = z.infer<typeof FaqItemSchema>;
export type ContentWarningType = z.infer<typeof ContentWarningTypeSchema>;
export type GeneratedContentWarning = z.infer<typeof ContentWarningSchema>;
export type SeoMetadata = z.infer<typeof SeoMetadataSchema>;
export type GeneratedArticle = z.infer<typeof GeneratedArticleSchema>;
