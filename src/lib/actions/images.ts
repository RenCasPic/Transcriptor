'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { checkRateLimit } from '@/lib/rate-limit';
import { getContentGenerationProvider } from '@/lib/ai/providers';
import { isImageGenerationConfigured } from '@/lib/ai/images/config';
import {
  ImageGenerationError,
  generateImage,
  imageErrorMessageEs,
  type ImageErrorCode,
} from '@/lib/ai/images/openai-image';
import { finalizeImagePrompt } from '@/lib/images/plan';
import {
  getMaxRegenerationsPerImage,
  isMissingRegenerationSchema,
  remainingRegenerations,
} from '@/lib/images/limits';
import { deleteArticleImage, pathFromPublicUrl, uploadArticleImage } from '@/lib/images/storage';
import { createVersionAction } from '@/lib/actions/versions';

const IMAGE_RATE_LIMIT = 20;
const IMAGE_RATE_WINDOW_SECONDS = 60 * 10;

/** Contexto del documento sobre el que se opera: valida sesión, permisos de lectura (RLS) y workspace. */
async function loadDocumentContext(documentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: err<never>('UNAUTHENTICATED', 'Debes iniciar sesión.') };

  const { data: document } = await supabase
    .from('content_documents')
    .select('id, title, project_id')
    .eq('id', documentId)
    .maybeSingle();
  if (!document) return { ok: false as const, error: err<never>('NOT_FOUND', 'Documento no encontrado.') };

  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id, language')
    .eq('id', document.project_id)
    .maybeSingle();
  if (!project) return { ok: false as const, error: err<never>('NOT_FOUND', 'Proyecto no encontrado.') };

  return { ok: true as const, supabase, user, document, project };
}

function imageError<T>(code: ImageErrorCode | 'RATE_LIMITED_LOCAL', message?: string): ActionResult<T> {
  const finalCode = code === 'RATE_LIMITED_LOCAL' ? 'RATE_LIMITED' : code;
  return err(finalCode, message ?? imageErrorMessageEs(finalCode as ImageErrorCode));
}

const GenerateImageSchema = z.object({
  documentId: z.string().uuid(),
  /** Descripción visual de la imagen (la edita el usuario). */
  prompt: z.string().trim().min(5, 'Escribe una descripción de al menos 5 caracteres.').max(1000),
  /** Qué imagen se regenera: 'cover' o el id de la imagen del cuerpo (para el límite por imagen). */
  imageKey: z.string().trim().min(1).max(80),
});

/**
 * Genera UNA imagen a partir de una descripción y la sube al bucket del
 * workspace. Devuelve su URL pública para mostrarla como vista previa: el
 * documento NO se modifica hasta que el usuario la acepta en el editor.
 *
 * Cada imagen tiene un tope de generaciones (`AI_IMAGE_MAX_REGENERATIONS`, 3 por
 * defecto): se reserva una antes de llamar a la IA y, si la IA falla, se devuelve.
 */
export async function generateArticleImageAction(
  input: z.infer<typeof GenerateImageSchema>,
): Promise<ActionResult<{ url: string; path: string; remaining: number; max: number }>> {
  const parsed = GenerateImageSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos.');

  if (!isImageGenerationConfigured()) return imageError('NOT_CONFIGURED');

  const ctx = await loadDocumentContext(parsed.data.documentId);
  if (!ctx.ok) return ctx.error;

  const rateLimit = checkRateLimit(`generate-image:${ctx.user.id}`, IMAGE_RATE_LIMIT, IMAGE_RATE_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return imageError(
      'RATE_LIMITED_LOCAL',
      `Demasiadas imágenes generadas. Espera ${rateLimit.retryAfterSeconds} segundos.`,
    );
  }

  // Tope de generaciones por imagen: se reserva una ANTES de gastar en la IA.
  const max = getMaxRegenerationsPerImage();
  let used = 1;
  let reserved = false;
  const reservation = await ctx.supabase.rpc('use_image_regeneration', {
    p_document_id: parsed.data.documentId,
    p_image_key: parsed.data.imageKey,
    p_max: max,
  });
  if (reservation.error) {
    // Migración 0023 sin aplicar: se genera igualmente, sin límite.
    if (!isMissingRegenerationSchema(reservation.error)) {
      console.error('[images] No se pudo reservar la regeneración:', reservation.error.message);
      return imageError('FAILED');
    }
  } else if (reservation.data === null) {
    return err('REGEN_LIMIT', regenLimitMessageEs(max));
  } else {
    used = reservation.data;
    reserved = true;
  }

  try {
    const file = await generateImage(finalizeImagePrompt(parsed.data.prompt));
    const uploaded = await uploadArticleImage(ctx.supabase, {
      workspaceId: ctx.project.workspace_id,
      projectId: ctx.project.id,
      file,
    });
    return ok({ ...uploaded, remaining: remainingRegenerations(used, max), max });
  } catch (error) {
    // Un intento fallido no cuenta para el límite.
    if (reserved) {
      await ctx.supabase.rpc('release_image_regeneration', {
        p_document_id: parsed.data.documentId,
        p_image_key: parsed.data.imageKey,
      });
    }
    if (error instanceof ImageGenerationError) return imageError(error.code);
    console.error('[images] generateArticleImageAction falló:', error);
    return imageError('FAILED');
  }
}

function regenLimitMessageEs(max: number): string {
  return `Alcanzaste el límite de ${max} regeneraciones de esta imagen. Puedes subir tu propia imagen con "Reemplazar".`;
}

const RegenStatusSchema = z.object({
  documentId: z.string().uuid(),
  imageKey: z.string().trim().min(1).max(80),
});

/** Cuántas regeneraciones lleva una imagen y cuántas le quedan (para mostrarlo en el diálogo). */
export async function getImageRegenerationStatusAction(
  input: z.infer<typeof RegenStatusSchema>,
): Promise<ActionResult<{ remaining: number; max: number }>> {
  const parsed = RegenStatusSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const ctx = await loadDocumentContext(parsed.data.documentId);
  if (!ctx.ok) return ctx.error;

  const max = getMaxRegenerationsPerImage();
  const { data, error } = await ctx.supabase
    .from('document_image_regenerations')
    .select('count')
    .eq('document_id', parsed.data.documentId)
    .eq('image_key', parsed.data.imageKey)
    .maybeSingle();

  if (error && !isMissingRegenerationSchema(error)) {
    console.error('[images] No se pudo leer el contador de regeneraciones:', error.message);
  }
  return ok({ remaining: remainingRegenerations(data?.count ?? 0, max), max });
}

const DiscardImageSchema = z.object({
  documentId: z.string().uuid(),
  url: z.string().url(),
});

/** Borra una imagen generada que el usuario descartó en la vista previa (solo de su workspace). */
export async function discardGeneratedImageAction(
  input: z.infer<typeof DiscardImageSchema>,
): Promise<ActionResult<null>> {
  const parsed = DiscardImageSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const ctx = await loadDocumentContext(parsed.data.documentId);
  if (!ctx.ok) return ctx.error;

  const path = pathFromPublicUrl(parsed.data.url);
  if (!path || !path.startsWith(`${ctx.project.workspace_id}/`)) {
    return err('FORBIDDEN', 'Esa imagen no pertenece a tu workspace.');
  }
  await deleteArticleImage(ctx.supabase, path);
  return ok(null);
}

const SuggestPromptSchema = z.object({
  documentId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
});

/**
 * Sugiere la descripción (y el texto alternativo) de una imagen a partir de un
 * párrafo. Si la IA no responde, devuelve el propio párrafo como punto de
 * partida: el usuario siempre puede editarlo.
 */
export async function suggestImagePromptAction(
  input: z.infer<typeof SuggestPromptSchema>,
): Promise<ActionResult<{ prompt: string; alt: string }>> {
  const parsed = SuggestPromptSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const ctx = await loadDocumentContext(parsed.data.documentId);
  if (!ctx.ok) return ctx.error;

  const rateLimit = checkRateLimit(`suggest-image:${ctx.user.id}`, 30, IMAGE_RATE_WINDOW_SECONDS);
  const fallback = {
    prompt: parsed.data.text.slice(0, 300),
    alt: parsed.data.text.slice(0, 120),
  };
  if (!rateLimit.allowed) return ok(fallback);

  try {
    const suggestion = await getContentGenerationProvider().suggestImagePrompt({
      title: ctx.document.title,
      text: parsed.data.text,
      language: ctx.project.language,
    });
    return ok(suggestion);
  } catch {
    return ok(fallback);
  }
}

const SetCoverSchema = z.object({
  documentId: z.string().uuid(),
  url: z.string().url(),
  alt: z.string().trim().max(300),
  /** Descripción con la que se generó (null si la portada es una imagen subida). */
  prompt: z.string().trim().max(1000).nullable(),
});

/**
 * Cambia la portada (generada o subida) y deja constancia en el historial de
 * versiones. Solo acepta imágenes del bucket del propio workspace.
 */
export async function setCoverImageAction(input: z.infer<typeof SetCoverSchema>): Promise<ActionResult<null>> {
  const parsed = SetCoverSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const ctx = await loadDocumentContext(parsed.data.documentId);
  if (!ctx.ok) return ctx.error;

  const path = pathFromPublicUrl(parsed.data.url);
  if (!path || !path.startsWith(`${ctx.project.workspace_id}/`)) {
    return err('FORBIDDEN', 'La portada debe ser una imagen de tu workspace.');
  }

  const { error } = await ctx.supabase
    .from('content_documents')
    .update({
      cover_image_url: parsed.data.url,
      cover_image_alt: parsed.data.alt,
      cover_image_prompt: parsed.data.prompt,
    })
    .eq('id', parsed.data.documentId);
  if (error) return err('SAVE_ERROR', 'No se pudo guardar la portada.');

  await createVersionAction({ documentId: parsed.data.documentId, reason: 'Portada: cambio de imagen' });
  revalidatePath(`/projects/${ctx.project.id}/editor`);
  return ok(null);
}

const UpdateCoverAltSchema = z.object({
  documentId: z.string().uuid(),
  alt: z.string().trim().max(300),
});

/** Edita solo el texto alternativo de la portada. */
export async function updateCoverAltAction(input: z.infer<typeof UpdateCoverAltSchema>): Promise<ActionResult<null>> {
  const parsed = UpdateCoverAltSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('content_documents')
    .update({ cover_image_alt: parsed.data.alt })
    .eq('id', parsed.data.documentId);
  if (error) return err('SAVE_ERROR', 'No se pudo guardar el texto alternativo.');
  return ok(null);
}
