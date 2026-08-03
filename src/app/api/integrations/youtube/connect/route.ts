import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { canManageWorkspace } from '@/lib/permissions';
import { signState } from '@/lib/security/crypto';
import { buildYoutubeAuthUrl } from '@/lib/integrations/youtube-client';

/**
 * Inicia el flujo OAuth de YouTube: verifica sesión y rol, genera un `state`
 * firmado (workspaceId + nonce) para validar el callback, y redirige al
 * consentimiento de Google.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.APP_URL ?? 'http://localhost:3000'));
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace || !canManageWorkspace(workspace.role)) {
    return NextResponse.redirect(
      new URL('/settings/integrations?youtube=error', process.env.APP_URL ?? 'http://localhost:3000'),
    );
  }

  let authUrl: string;
  try {
    const state = signState(JSON.stringify({ workspaceId: workspace.id, nonce: randomBytes(16).toString('hex') }));
    authUrl = buildYoutubeAuthUrl(state);
  } catch {
    return NextResponse.redirect(
      new URL('/settings/integrations?youtube=error', process.env.APP_URL ?? 'http://localhost:3000'),
    );
  }

  return NextResponse.redirect(authUrl);
}
