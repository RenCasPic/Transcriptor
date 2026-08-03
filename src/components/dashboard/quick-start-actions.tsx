'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Youtube, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createQuickProjectAction } from '@/lib/actions/projects';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

type Source = 'upload' | 'youtube';

/**
 * Los dos únicos accesos directos del Dashboard para empezar contenido
 * nuevo: crean un proyecto con configuración por defecto (editable después
 * desde la página del proyecto) y van directo a importar la fuente, sin
 * pasar por el formulario de `/projects/new`.
 */
export function QuickStartActions({ youtubeConnected }: { youtubeConnected: boolean }) {
  const router = useRouter();
  const t = useDictionary();
  const [loadingSource, setLoadingSource] = useState<Source | null>(null);

  async function handleStart(source: Source) {
    setLoadingSource(source);
    const result = await createQuickProjectAction({ source });

    if (!result.success) {
      setLoadingSource(null);
      if (result.error.code === 'YOUTUBE_NOT_CONNECTED') {
        router.push('/settings/integrations');
        return;
      }
      toast.error(result.error.message);
      return;
    }

    router.push(`/projects/${result.data.id}?tab=${source === 'upload' ? 'media' : 'youtube'}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => handleStart('upload')} disabled={loadingSource !== null}>
        {loadingSource === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
        {t.dashboard.uploadVideo}
      </Button>
      <Button
        variant="outline"
        onClick={() => handleStart('youtube')}
        disabled={loadingSource !== null}
        title={!youtubeConnected ? t.settings.integrations.notConnected : undefined}
      >
        {loadingSource === 'youtube' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
        {t.dashboard.connectYoutube}
      </Button>
    </div>
  );
}
