import type { Metadata } from 'next';
import { QuickStartActions } from '@/components/dashboard/quick-start-actions';
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
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>
      <QuickStartActions youtubeConnected={youtube.status === 'connected'} />
    </div>
  );
}
