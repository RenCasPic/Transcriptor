import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { getIntegration } from '@/lib/data/integrations';
import { canManageWorkspace } from '@/lib/permissions';
import { YoutubeIntegrationCard } from '@/components/settings/youtube-integration-card';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.nav.integrations };
}

export default async function IntegrationsSettingsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) redirect('/login');

  const youtube = await getIntegration(workspace.id, 'youtube');

  return (
    <div className="space-y-6">
      <YoutubeIntegrationCard
        workspaceId={workspace.id}
        status={youtube.status}
        channelTitle={youtube.channelTitle}
        canManage={canManageWorkspace(workspace.role)}
      />
    </div>
  );
}
