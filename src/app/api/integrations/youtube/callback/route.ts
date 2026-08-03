import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { canManageWorkspace } from '@/lib/permissions';
import { verifyState } from '@/lib/security/crypto';
import { encryptYoutubeRefreshToken } from '@/lib/integrations/youtube-tokens';
import { exchangeYoutubeCode, fetchOwnChannel } from '@/lib/integrations/youtube-client';

function redirect(path: string) {
  return NextResponse.redirect(new URL(path, process.env.APP_URL ?? 'http://localhost:3000'));
}

/**
 * Intercambia el `code` de Google por tokens, obtiene el canal propio del
 * usuario, cifra el refresh token y hace upsert en `integrations`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  if (oauthError || !code || !state) {
    return redirect('/settings/integrations?youtube=error');
  }

  const decodedState = verifyState(state);
  if (!decodedState) {
    return redirect('/settings/integrations?youtube=error');
  }

  let workspaceId: string;
  try {
    workspaceId = (JSON.parse(decodedState) as { workspaceId: string }).workspaceId;
  } catch {
    return redirect('/settings/integrations?youtube=error');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login');
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace || workspace.id !== workspaceId || !canManageWorkspace(workspace.role)) {
    return redirect('/settings/integrations?youtube=error');
  }

  try {
    const tokens = await exchangeYoutubeCode(code);
    if (!tokens.refreshToken) {
      // Google solo entrega refresh_token la primera vez que el usuario autoriza
      // (o si se fuerza prompt=consent, que ya hacemos). Sin él no podemos
      // mantener la conexión activa.
      return redirect('/settings/integrations?youtube=error');
    }

    const channel = await fetchOwnChannel(tokens.accessToken);
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    const { error } = await supabase.from('integrations').upsert(
      {
        workspace_id: workspace.id,
        provider: 'youtube',
        status: 'connected',
        encrypted_credentials: encryptYoutubeRefreshToken(tokens.refreshToken),
        metadata: {
          channelId: channel.channelId,
          channelTitle: channel.channelTitle,
          uploadsPlaylistId: channel.uploadsPlaylistId,
          accessToken: tokens.accessToken,
          accessTokenExpiresAt,
        },
      },
      { onConflict: 'workspace_id,provider' },
    );

    if (error) {
      return redirect('/settings/integrations?youtube=error');
    }

    return redirect('/settings/integrations?youtube=connected');
  } catch {
    return redirect('/settings/integrations?youtube=error');
  }
}
