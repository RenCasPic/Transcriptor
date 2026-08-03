'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';

const DisconnectIntegrationSchema = z.object({
  workspaceId: z.string().uuid(),
  provider: z.enum(['wordpress', 'webflow', 'ghost', 'youtube']),
});

export type DisconnectIntegrationInput = z.infer<typeof DisconnectIntegrationSchema>;

/**
 * Desconecta una integración: limpia credenciales cifradas y metadata, y
 * marca el estado como `disconnected`. La política RLS de `integrations`
 * (owner/admin) es la autorización real; esto solo evita dejar el
 * refresh token en la base tras la desconexión.
 */
export async function disconnectIntegrationAction(
  input: DisconnectIntegrationInput,
): Promise<ActionResult<null>> {
  const parsed = DisconnectIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('integrations')
    .update({ status: 'disconnected', encrypted_credentials: null, metadata: {} })
    .eq('workspace_id', parsed.data.workspaceId)
    .eq('provider', parsed.data.provider);

  if (error) {
    return err('DISCONNECT_INTEGRATION_ERROR', 'No se pudo desconectar la integración.');
  }

  revalidatePath('/settings/integrations');
  return ok(null);
}
