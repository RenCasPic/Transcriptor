import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { UploadVideoCard } from '@/components/dashboard/upload-video-card';
import { YoutubeUrlCard } from '@/components/dashboard/youtube-url-card';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { isTranscriptionConfigured } from '@/lib/ai/transcription';
import { isContentGenerationConfigured } from '@/lib/ai/providers';
import { getMediaLimits } from '@/lib/media/limits';

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
      </div>

      {(!isTranscriptionConfigured() || !isContentGenerationConfigured()) && (
        <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t.dashboard.setupRequiredTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.setupRequiredDescription}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <UploadVideoCard mediaLimits={getMediaLimits()} />
        <YoutubeUrlCard />
      </div>
    </div>
  );
}
