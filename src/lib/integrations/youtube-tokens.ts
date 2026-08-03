import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/security/crypto';
import { refreshYoutubeAccessToken, type YoutubeOwnChannel } from '@/lib/integrations/youtube-client';
import type { Database } from '@/lib/types/database';

interface YoutubeIntegrationMetadata extends Partial<YoutubeOwnChannel> {
  accessToken?: string;
  accessTokenExpiresAt?: string;
}

/**
 * Lee la integración de YouTube del workspace, descifra el refresh token y
 * devuelve un access token válido, renovándolo (y persistiendo el nuevo) si
 * el cacheado en `metadata` ya venció. Devuelve `null` si no hay integración
 * conectada.
 */
export async function getValidYoutubeAccessToken(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<string | null> {
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, status, encrypted_credentials, metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'youtube')
    .maybeSingle();

  if (!integration || integration.status !== 'connected' || !integration.encrypted_credentials) {
    return null;
  }

  const refreshToken = decryptSecret(integration.encrypted_credentials);
  const metadata = (integration.metadata ?? {}) as YoutubeIntegrationMetadata;

  const expiresAt = metadata.accessTokenExpiresAt ? new Date(metadata.accessTokenExpiresAt).getTime() : 0;
  const hasValidCachedToken = metadata.accessToken && expiresAt - 60_000 > Date.now();
  if (hasValidCachedToken) {
    return metadata.accessToken!;
  }

  const refreshed = await refreshYoutubeAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

  await supabase
    .from('integrations')
    .update({
      metadata: { ...metadata, accessToken: refreshed.accessToken, accessTokenExpiresAt: newExpiresAt },
    })
    .eq('id', integration.id);

  return refreshed.accessToken;
}

/** Cifra un refresh token para guardarlo en `integrations.encrypted_credentials`. */
export function encryptYoutubeRefreshToken(refreshToken: string): string {
  return encryptSecret(refreshToken);
}
