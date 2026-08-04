'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';

const SetDocumentPublicSchema = z.object({
  documentId: z.string().uuid(),
  isPublic: z.boolean(),
});

export type SetDocumentPublicInput = z.infer<typeof SetDocumentPublicSchema>;

/**
 * Activa o desactiva el acceso público de solo lectura a un artículo (usado
 * para el enlace/iframe de inserción). El contenido interno del workspace
 * (proyecto, transcripción, historial) nunca se expone: solo el documento
 * final vía `getPublicDocument`.
 */
export async function setDocumentPublicAction(
  input: SetDocumentPublicInput,
): Promise<ActionResult<{ isPublic: boolean; documentId: string; projectId: string }>> {
  const parsed = SetDocumentPublicSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const { data: document } = await supabase
    .from('content_documents')
    .select('id, project_id')
    .eq('id', parsed.data.documentId)
    .maybeSingle();
  if (!document) {
    return err('NOT_FOUND', 'Artículo no encontrado.');
  }

  const { error } = await supabase
    .from('content_documents')
    .update({
      is_public: parsed.data.isPublic,
      published_at: parsed.data.isPublic ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.documentId);

  if (error) {
    return err('UPDATE_VISIBILITY_ERROR', 'No se pudo actualizar la visibilidad del artículo.');
  }

  revalidatePath(`/projects/${document.project_id}/editor`);
  revalidatePath(`/embed/${parsed.data.documentId}`);
  return ok({ isPublic: parsed.data.isPublic, documentId: parsed.data.documentId, projectId: document.project_id });
}
