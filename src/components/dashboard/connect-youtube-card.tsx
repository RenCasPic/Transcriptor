'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Youtube, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArticleConfigFields } from './article-config-fields';
import { ArticleConfigSchema, type ArticleConfigInput } from '@/lib/validations/project';
import { createQuickProjectAction } from '@/lib/actions/projects';
import { listYoutubeVideosAction, importYoutubeCaptionsAction } from '@/lib/actions/youtube';
import type { YoutubeVideo } from '@/lib/integrations/youtube-client';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function ConnectYoutubeCard({
  workspaceId,
  youtubeConnected,
}: {
  workspaceId: string;
  youtubeConnected: boolean;
}) {
  const router = useRouter();
  const t = useDictionary();
  const [videos, setVideos] = useState<YoutubeVideo[] | null>(null);
  const [isLoading, setIsLoading] = useState(youtubeConnected);
  const [loadError, setLoadError] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState<string | null>(null);

  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<ArticleConfigInput>({
    resolver: zodResolver(ArticleConfigSchema),
    defaultValues: { contentType: 'guide', tone: 'professional' },
  });

  useEffect(() => {
    if (!youtubeConnected) return;
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
  }, [workspaceId, youtubeConnected]);

  async function handleImport(video: YoutubeVideo) {
    setImportingVideoId(video.videoId);
    try {
      const projectResult = await createQuickProjectAction({ source: 'youtube', ...getValues() });
      if (!projectResult.success) {
        toast.error(projectResult.error.message);
        return;
      }
      const projectId = projectResult.data.id;

      const result = await importYoutubeCaptionsAction({
        projectId,
        workspaceId,
        videoId: video.videoId,
        videoTitle: video.title,
        language: 'es',
      });

      if (!result.success) {
        toast.error(result.error.message);
        router.push(`/projects/${projectId}?tab=youtube`);
        return;
      }

      toast.success(t.projects.source.youtubeImportSuccess);
      router.push(`/projects/${projectId}`);
    } finally {
      setImportingVideoId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Youtube className="h-4 w-4" />
          {t.dashboard.connectYoutube}
        </CardTitle>
        {!youtubeConnected && (
          <Button asChild>
            <a href="/api/integrations/youtube/connect">
              <Youtube className="h-4 w-4" />
              {t.dashboard.connectYoutube}
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!youtubeConnected ? (
          <p className="text-sm text-muted-foreground">{t.projects.source.youtubeNotConnected}</p>
        ) : (
          <>
            <ArticleConfigFields idPrefix="youtube" register={register} control={control} errors={errors} />

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.projects.source.youtubeLoading}
              </div>
            ) : loadError ? (
              <p className="text-sm text-muted-foreground">{t.projects.source.youtubeLoadError}</p>
            ) : !videos || videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.projects.source.youtubeEmpty}</p>
            ) : (
              <div className="grid gap-3">
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
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
