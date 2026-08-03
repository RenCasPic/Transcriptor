'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { listYoutubeVideosAction, importYoutubeCaptionsAction } from '@/lib/actions/youtube';
import type { YoutubeVideo } from '@/lib/integrations/youtube-client';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function YoutubeImportPanel({
  projectId,
  workspaceId,
  language,
}: {
  projectId: string;
  workspaceId: string;
  language: string;
}) {
  const t = useDictionary();
  const router = useRouter();
  const [videos, setVideos] = useState<YoutubeVideo[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(false);
      const result = await listYoutubeVideosAction({ workspaceId });
      if (cancelled) return;
      setIsLoading(false);

      if (!result.success) {
        setLoadError(true);
        return;
      }
      setVideos(result.data.videos);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleImport(video: YoutubeVideo) {
    setImportingVideoId(video.videoId);
    const result = await importYoutubeCaptionsAction({
      projectId,
      workspaceId,
      videoId: video.videoId,
      videoTitle: video.title,
      language,
    });
    setImportingVideoId(null);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t.projects.source.youtubeImportSuccess);
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.projects.source.youtubeLoading}
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-muted-foreground">{t.projects.source.youtubeLoadError}</p>;
  }

  if (!videos || videos.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.projects.source.youtubeEmpty}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {videos.map((video) => (
        <div key={video.videoId} className="flex items-center gap-3 rounded-lg border p-3">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt=""
              width={80}
              height={45}
              className="h-11 w-20 shrink-0 rounded object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-11 w-20 shrink-0 items-center justify-center rounded bg-muted">
              <Youtube className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <p className="line-clamp-2 flex-1 text-sm">{video.title}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleImport(video)}
            disabled={importingVideoId === video.videoId}
          >
            {importingVideoId === video.videoId && <Loader2 className="h-4 w-4 animate-spin" />}
            {importingVideoId === video.videoId
              ? t.projects.source.youtubeImporting
              : t.projects.source.youtubeImportButton}
          </Button>
        </div>
      ))}
    </div>
  );
}
