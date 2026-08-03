import type { Metadata } from 'next';
import { UploadVideoCard } from '@/components/dashboard/upload-video-card';
import { ConnectYoutubeCard } from '@/components/dashboard/connect-youtube-card';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { getIntegration } from '@/lib/data/integrations';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.dashboard.title };
}

export default async function DashboardPage() {
  const workspace = await getCurrentWorkspace();
  const { dictionary: t } = await getDictionary();

  if (!workspace) {
    return null;
  }

  const youtube = await getIntegration(workspace.id, 'youtube');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UploadVideoCard workspaceId={workspace.id} />
        <ConnectYoutubeCard workspaceId={workspace.id} youtubeConnected={youtube.status === 'connected'} />
      </div>
    </div>
  );
}
