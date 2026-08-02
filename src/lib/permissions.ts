import type { WorkspaceRole } from '@/lib/types/database';

/**
 * Refleja en el cliente las mismas reglas que las políticas RLS aplican en la
 * base de datos (ver `has_workspace_role` en supabase/migrations/0003_workspaces.sql).
 * Se usa únicamente para decisiones de UI (mostrar/ocultar controles); la
 * autorización real siempre la garantiza RLS en el servidor.
 */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canEditProject(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

export function canDeleteProject(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}
