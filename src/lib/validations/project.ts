import { z } from 'zod';

export const CONTENT_TYPES = [
  'tutorial',
  'guide',
  'list',
  'interview',
  'summary',
  'case_study',
  'opinion',
  'qa',
] as const;

export const ARTICLE_TONES = [
  'professional',
  'educational',
  'conversational',
  'persuasive',
  'technical',
  'friendly',
] as const;

export const CreateProjectSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  provisionalTitle: z.string().max(200).optional().or(z.literal('')),
  contentType: z.enum(CONTENT_TYPES),
  audience: z.string().max(200).optional().or(z.literal('')),
  tone: z.enum(ARTICLE_TONES),
  language: z.string().min(2).max(10).default('es'),
  primaryKeyword: z.string().max(120).optional().or(z.literal('')),
  objective: z.string().max(500).optional().or(z.literal('')),
  callToAction: z.string().max(300).optional().or(z.literal('')),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Subconjunto de `CreateProjectSchema` con solo los campos de "configuración
 * del artículo" (sin nombre/título/idioma). Se usa en las dos tarjetas del
 * Dashboard (subir video / conectar YouTube), donde el nombre se genera
 * automáticamente y no hay selector de idioma.
 */
export const ArticleConfigSchema = CreateProjectSchema.omit({
  name: true,
  provisionalTitle: true,
  language: true,
});

export type ArticleConfigInput = z.infer<typeof ArticleConfigSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  status: z.enum(['draft', 'processing', 'review', 'ready', 'published', 'failed']).optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const ImportTranscriptSchema = z.object({
  projectId: z.string().uuid(),
  sourceType: z.enum(['manual', 'txt', 'srt', 'vtt']),
  text: z.string().min(20, 'La transcripción es demasiado corta para generar un artículo útil'),
  originalFilename: z.string().optional(),
  storagePath: z.string().optional(),
  language: z.string().min(2).max(10).default('es'),
});

export type ImportTranscriptInput = z.infer<typeof ImportTranscriptSchema>;
