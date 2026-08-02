import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getCurrentWorkspace, listWorkspaceMembers } from '@/lib/data/workspace';
import { WORKSPACE_ROLE_LABELS } from '@/lib/types/domain';
import { canManageWorkspace } from '@/lib/permissions';
import { WorkspaceNameForm } from './workspace-name-form';

export const metadata: Metadata = { title: 'Espacio de trabajo' };

export default async function WorkspaceSettingsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect('/login');

  const members = await listWorkspaceMembers(workspace.id);
  const canEdit = canManageWorkspace(workspace.role);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del espacio de trabajo</CardTitle>
          <CardDescription>
            Slug: <code className="rounded bg-muted px-1 py-0.5">{workspace.slug}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceNameForm workspaceId={workspace.id} defaultName={workspace.name} disabled={!canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>Personas con acceso a este espacio de trabajo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {(member.fullName ?? 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {member.fullName ?? 'Usuario'} {member.isCurrentUser && '(tú)'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{WORKSPACE_ROLE_LABELS[member.role]}</Badge>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Próximamente: invitar nuevos miembros por correo electrónico.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
