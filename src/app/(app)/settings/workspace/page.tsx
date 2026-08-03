import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getCurrentWorkspace, listWorkspaceMembers } from '@/lib/data/workspace';
import { canManageWorkspace } from '@/lib/permissions';
import { WorkspaceNameForm } from './workspace-name-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getDomainLabels } from '@/lib/i18n/domain-labels';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.nav.workspace };
}

export default async function WorkspaceSettingsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect('/login');

  const members = await listWorkspaceMembers(workspace.id);
  const canEdit = canManageWorkspace(workspace.role);
  const { dictionary: t, locale } = await getDictionary();
  const domainLabels = getDomainLabels(locale);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.workspace.dataTitle}</CardTitle>
          <CardDescription>
            {t.settings.workspace.slugLabel}: <code className="rounded bg-muted px-1 py-0.5">{workspace.slug}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceNameForm workspaceId={workspace.id} defaultName={workspace.name} disabled={!canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.workspace.membersTitle}</CardTitle>
          <CardDescription>{t.settings.workspace.membersDescription}</CardDescription>
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
                    {member.fullName ?? t.settings.workspace.unnamedUser} {member.isCurrentUser && t.settings.workspace.you}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{domainLabels.workspaceRole[member.role]}</Badge>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">{t.settings.workspace.inviteComingSoon}</p>
        </CardContent>
      </Card>
    </div>
  );
}
