'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { countWords, estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { proseMirrorJsonToMarkdown, proseMirrorJsonToPlainText } from '@/lib/content/article-transform';
import { getContentGenerationProvider } from '@/lib/ai/providers';
import { checkRateLimit } from '@/lib/rate-limit';
import type { Json } from '@/lib/types/database';
import type { RewriteInstruction } from '@/lib/ai/provider';

const SaveDocumentSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(1).max(300),
  contentJson: z.unknown(),
  contentHtml: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export interface SaveDocumentResult {
  version: number;
  wordCount: number;
  readingTimeMinutes: number;
}

/**
 * Guarda el documento con control de concurrencia optimista: si `expectedVersion`
 * no coincide con la versión actual en base de datos, se asume que otra pestaña
 * u otro colaborador guardó cambios más recientes y se rechaza el guardado
 * (evita sobrescribir cambios recientes, requisito 4.10).
 */
export async function saveDocumentAction(input: z.infer<typeof SaveDocumentSchema>): Promise<ActionResult<SaveDocumentResult>> {
  const parsed = SaveDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', 'Datos del documento inválidos.');
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from('content_documents')
    .select('version')
    .eq('id', parsed.data.documentId)
    .maybeSingle();

  if (!current) {
    return err('NOT_FOUND', 'Documento no encontrado.');
  }

  if (current.version !== parsed.data.expectedVersion) {
    return err('VERSION_CONFLICT', 'El documento fue modificado en otra sesión. Recarga la página para continuar.');
  }

  const sanitizedHtml = DOMPurify.sanitize(parsed.data.contentHtml, {
    ALLOWED_TAGS: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'data-block-id'],
  });

  const contentJson = parsed.data.contentJson as Json;
  const plainText = proseMirrorJsonToPlainText(contentJson);
  const wordCount = countWords(plainText);
  const readingTimeMinutes = estimateReadingTimeMinutes(wordCount);
  const contentMarkdown = proseMirrorJsonToMarkdown(contentJson);
  const nextVersion = current.version + 1;

  const { error } = await supabase
    .from('content_documents')
    .update({
      title: parsed.data.title,
      content_json: contentJson,
      content_html: sanitizedHtml,
      content_markdown: contentMarkdown,
      word_count: wordCount,
      reading_time_minutes: readingTimeMinutes,
      version: nextVersion,
    })
    .eq('id', parsed.data.documentId)
    .eq('version', parsed.data.expectedVersion);

  if (error) {
    return err('SAVE_ERROR', 'No se pudo guardar el documento.');
  }

  return ok({ version: nextVersion, wordCount, readingTimeMinutes });
}

const RewriteSectionSchema = z.object({
  documentId: z.string().uuid(),
  projectId: z.string().uuid(),
  text: z.string().min(1),
  instruction: z.enum([
    'rewrite',
    'shorten',
    'expand',
    'simplify',
    'more_professional',
    'more_conversational',
    'improve_seo',
    'convert_to_list',
    'fix_grammar',
    'regenerate',
  ]),
});

export async function rewriteSectionAction(
  input: z.infer<typeof RewriteSectionSchema>,
): Promise<ActionResult<{ text: string }>> {
  const parsed = RewriteSectionSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', 'Datos inválidos.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHENTICATED', 'Debes iniciar sesión.');

  const rateLimit = checkRateLimit(`rewrite-section:${user.id}`, 30, 60 * 10);
  if (!rateLimit.allowed) {
    return err('RATE_LIMITED', `Demasiadas solicitudes de IA. Espera ${rateLimit.retryAfterSeconds} segundos.`);
  }

  const { data: project } = await supabase
    .from('projects')
    .select('tone, language, audience, primary_keyword')
    .eq('id', parsed.data.projectId)
    .maybeSingle();

  if (!project) return err('NOT_FOUND', 'Proyecto no encontrado.');

  try {
    const provider = getContentGenerationProvider();
    const text = await provider.rewriteSection({
      text: parsed.data.text,
      instruction: parsed.data.instruction as RewriteInstruction,
      tone: project.tone,
      language: project.language,
      audience: project.audience,
      primaryKeyword: project.primary_keyword,
    });
    return ok({ text });
  } catch {
    return err('AI_ERROR', 'No se pudo generar la reescritura. Inténtalo de nuevo.');
  }
}

const RegenerateSeoSchema = z.object({
  documentId: z.string().uuid(),
});

export async function regenerateSeoAction(
  input: z.infer<typeof RegenerateSeoSchema>,
): Promise<ActionResult<null>> {
  const parsed = RegenerateSeoSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHENTICATED', 'Debes iniciar sesión.');

  const rateLimit = checkRateLimit(`regenerate-seo:${user.id}`, 15, 60 * 10);
  if (!rateLimit.allowed) {
    return err('RATE_LIMITED', `Demasiadas solicitudes de IA. Espera ${rateLimit.retryAfterSeconds} segundos.`);
  }

  const { data: document } = await supabase
    .from('content_documents')
    .select('id, title, excerpt, content_json, project_id')
    .eq('id', parsed.data.documentId)
    .maybeSingle();
  if (!document) return err('NOT_FOUND', 'Documento no encontrado.');

  const { data: project } = await supabase
    .from('projects')
    .select('language, primary_keyword')
    .eq('id', document.project_id)
    .maybeSingle();
  if (!project) return err('NOT_FOUND', 'Proyecto no encontrado.');

  try {
    const provider = getContentGenerationProvider();
    const seo = await provider.generateSeoMetadata({
      title: document.title,
      excerpt: document.excerpt ?? '',
      contentPlainText: proseMirrorJsonToPlainText(document.content_json as Json),
      primaryKeyword: project.primary_keyword,
      language: project.language,
    });

    const { error } = await supabase.from('seo_metadata').upsert(
      {
        document_id: document.id,
        seo_title: seo.title,
        slug: seo.slug,
        meta_description: seo.metaDescription,
        primary_keyword: seo.primaryKeyword ?? null,
        secondary_keywords: seo.secondaryKeywords,
      },
      { onConflict: 'document_id' },
    );

    if (error) return err('SAVE_ERROR', 'No se pudo guardar la metadata SEO.');

    revalidatePath(`/projects/${document.project_id}/editor`);
    return ok(null);
  } catch {
    return err('AI_ERROR', 'No se pudo generar la metadata SEO. Inténtalo de nuevo.');
  }
}

const UpdateSeoSchema = z.object({
  documentId: z.string().uuid(),
  seoTitle: z.string().max(70).optional(),
  slug: z.string().max(120).optional(),
  metaDescription: z.string().max(200).optional(),
  primaryKeyword: z.string().max(120).optional(),
  secondaryKeywords: z.array(z.string()).optional(),
});

export async function updateSeoMetadataAction(
  input: z.infer<typeof UpdateSeoSchema>,
): Promise<ActionResult<null>> {
  const parsed = UpdateSeoSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (parsed.data.seoTitle !== undefined) update.seo_title = parsed.data.seoTitle;
  if (parsed.data.slug !== undefined) update.slug = parsed.data.slug;
  if (parsed.data.metaDescription !== undefined) update.meta_description = parsed.data.metaDescription;
  if (parsed.data.primaryKeyword !== undefined) update.primary_keyword = parsed.data.primaryKeyword;
  if (parsed.data.secondaryKeywords !== undefined) update.secondary_keywords = parsed.data.secondaryKeywords;

  const { error } = await supabase
    .from('seo_metadata')
    .upsert({ document_id: parsed.data.documentId, ...update }, { onConflict: 'document_id' });

  if (error) return err('SAVE_ERROR', 'No se pudo actualizar la metadata SEO.');
  return ok(null);
}

const UpdateExcerptSchema = z.object({
  documentId: z.string().uuid(),
  excerpt: z.string().max(400),
});

export async function updateDocumentExcerptAction(
  input: z.infer<typeof UpdateExcerptSchema>,
): Promise<ActionResult<null>> {
  const parsed = UpdateExcerptSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('content_documents')
    .update({ excerpt: parsed.data.excerpt })
    .eq('id', parsed.data.documentId);

  if (error) return err('SAVE_ERROR', 'No se pudo actualizar el extracto.');
  return ok(null);
}

const ResolveWarningSchema = z.object({
  warningId: z.string().uuid(),
  status: z.enum(['open', 'reviewed', 'resolved', 'dismissed']),
});

export async function resolveWarningAction(
  input: z.infer<typeof ResolveWarningSchema>,
): Promise<ActionResult<null>> {
  const parsed = ResolveWarningSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('content_warnings')
    .update({
      status: parsed.data.status,
      resolved_at: parsed.data.status === 'open' ? null : new Date().toISOString(),
      resolved_by: parsed.data.status === 'open' ? null : (user?.id ?? null),
    })
    .eq('id', parsed.data.warningId);

  if (error) return err('SAVE_ERROR', 'No se pudo actualizar la alerta.');
  return ok(null);
}
