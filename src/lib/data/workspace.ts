import { createClient } from '@/lib/supabase/server';
import type { WorkspaceRole } from '@/lib/types/database';

export interface CurrentWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

/**
 * Devuelve el workspace principal del usuario autenticado (el más antiguo al
 * que pertenece). El MVP no expone selector de workspace: cada usuario opera
 * sobre su espacio personal creado automáticamente al registrarse.
 */
export async function getCurrentWorkspace(): Promise<CurrentWorkspace | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .eq('id', membership.workspace_id)
    .maybeSingle();

  if (!workspace) return null;

  return { ...workspace, role: membership.role };
}

export interface WorkspaceMemberItem {
  userId: string;
  role: WorkspaceRole;
  fullName: string | null;
  isCurrentUser: boolean;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (!members || members.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in(
      'id',
      members.map((m) => m.user_id),
    );

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return members.map((member) => ({
    userId: member.user_id,
    role: member.role,
    fullName: profileById.get(member.user_id) ?? null,
    isCurrentUser: member.user_id === user?.id,
  }));
}

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  return { email: user.email ?? '', ...profile };
}
