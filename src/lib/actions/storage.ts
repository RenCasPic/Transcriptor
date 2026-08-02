'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';

const SIGNED_URL_TTL_SECONDS = 60;

const GetSignedUrlSchema = z.object({
  mediaSourceId: z.string().uuid(),
});

/**
 * Genera una URL firmada de corta duración para el archivo original de una
 * fuente de contenido. Se usa el cliente con la sesión del usuario (no la
 * service role key): la política RLS de storage.objects ya garantiza que solo
 * los miembros del workspace correspondiente puedan generar la URL.
 */
export async function getMediaSourceSignedUrlAction(
  input: z.infer<typeof GetSignedUrlSchema>,
): Promise<ActionResult<{ url: string }>> {
  const parsed = GetSignedUrlSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();

  const { data: source } = await supabase
    .from('media_sources')
    .select('storage_path')
    .eq('id', parsed.data.mediaSourceId)
    .maybeSingle();

  if (!source?.storage_path) {
    return err('NOT_FOUND', 'No hay un archivo original disponible para esta fuente.');
  }

  const { data, error } = await supabase.storage
    .from('project-sources')
    .createSignedUrl(source.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return err('SIGN_URL_ERROR', 'No se pudo generar el enlace del archivo.');
  }

  return ok({ url: data.signedUrl });
}
