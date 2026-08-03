import { createClient } from '@/lib/supabase/server';
import type { IntegrationProvider, IntegrationStatus } from '@/lib/types/database';

export interface IntegrationSummary {
  status: IntegrationStatus;
  channelTitle: string | null;
}

/**
 * Lectura de solo estado/metadata pública de una integración (nunca expone
 * `encrypted_credentials`). Usado tanto en la página de Configuración como en
 * el panel de importación de un proyecto.
 */
export async function getIntegration(
  workspaceId: string,
  provider: IntegrationProvider,
): Promise<IntegrationSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('integrations')
    .select('status, metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle();

  if (!data) {
    return { status: 'disconnected', channelTitle: null };
  }

  const metadata = (data.metadata ?? {}) as { channelTitle?: string };
  return { status: data.status, channelTitle: metadata.channelTitle ?? null };
}
