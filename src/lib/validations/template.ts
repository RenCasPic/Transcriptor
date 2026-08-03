import { z } from 'zod';
import { CONTENT_TYPES, ARTICLE_TONES } from './project';

export const CreateTemplateSchema = z.object({
  name: z.string().min(3, 'Dale un nombre a la plantilla (mínimo 3 caracteres)').max(120),
  contentType: z.enum(CONTENT_TYPES),
  audience: z.string().max(200).optional().or(z.literal('')),
  tone: z.enum(ARTICLE_TONES),
  language: z.string().min(2).max(10).default('es'),
  primaryKeyword: z.string().max(120).optional().or(z.literal('')),
  objective: z.string().max(500).optional().or(z.literal('')),
  callToAction: z.string().max(300).optional().or(z.literal('')),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
