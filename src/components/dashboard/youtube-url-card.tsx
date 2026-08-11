'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Youtube, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArticleConfigFields } from './article-config-fields';
import { ImportErrorPanel } from './import-error-panel';
import { ArticleConfigSchema, type ArticleConfigInput } from '@/lib/validations/project';
import { createQuickProjectAction, updateProjectAction, deleteProjectAction } from '@/lib/actions/projects';
import { generateArticleAction } from '@/lib/actions/generation';
import { useYoutubeImport } from '@/lib/youtube/use-youtube-import';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function YoutubeUrlCard() {
  const router = useRouter();
  const t = useDictionary();
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importError, setImportError] = useState<{ code: string; message: string } | null>(null);
  const { stage, run } = useYoutubeImport();

  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<ArticleConfigInput>({
    resolver: zodResolver(ArticleConfigSchema),
    defaultValues: { contentType: 'guide', tone: 'professional' },
  });

  async function handleImport() {
    if (!videoUrl.trim()) return;

    setImportError(null);
    setIsSubmitting(true);
    try {
      const projectResult = await createQuickProjectAction({ source: 'youtube', ...getValues() });
      if (!projectResult.success) {
        toast.error(projectResult.error.message);
        return;
      }
      const projectId = projectResult.data.id;

      const result = await run({ projectId, videoUrl: videoUrl.trim(), language: 'es' });
      if (!result.success) {
        // El proyecto rápido no tiene ningún contenido útil si el import
        // falló: se elimina en vez de dejarlo como un proyecto "Fallido"
        // huérfano, y se explica el error en el propio dashboard.
        await deleteProjectAction(projectId);
        setImportError({ code: result.error.code, message: result.error.message });
        return;
      }

      await updateProjectAction(projectId, { name: result.data.title });

      const generationResult = await generateArticleAction(projectId);
      if (!generationResult.success) {
        toast.error(generationResult.error.message);
        router.push(`/projects/${projectId}`);
        return;
      }

      toast.success(t.projects.source.youtubeImportSuccess);
      if (result.data.isDemo) {
        toast.info(t.projects.source.youtubeDemoModeNotice);
      }
      router.push(`/projects/${projectId}/editor`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Youtube className="h-4 w-4" />
          {t.dashboard.pasteLink}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ArticleConfigFields idPrefix="youtube" register={register} control={control} errors={errors} />

        <div className="flex gap-2">
          <Input
            placeholder={t.projects.source.youtubeUrlPlaceholder}
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={isSubmitting}
          />
          <Button onClick={handleImport} disabled={isSubmitting || !videoUrl.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
            {t.dashboard.pasteLink}
          </Button>
        </div>
        {isSubmitting && stage !== 'idle' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t.projects.source.youtubeStages[stage]}
          </p>
        )}
        {importError && (
          <ImportErrorPanel
            title={
              importError.code === 'YOUTUBE_EXTRACTOR_INCOMPATIBLE'
                ? t.dashboard.importError.extractorIncompatibleTitle
                : t.dashboard.importError.title
            }
            message={importError.message}
            dismissLabel={t.dashboard.importError.dismiss}
            onDismiss={() => setImportError(null)}
            tips={
              importError.code === 'YOUTUBE_EXTRACTOR_INCOMPATIBLE'
                ? [t.dashboard.importError.extractorIncompatibleTip1, t.dashboard.importError.extractorIncompatibleTip2]
                : [
                    t.dashboard.importError.youtubeTip1,
                    t.dashboard.importError.youtubeTip2,
                    t.dashboard.importError.youtubeTip3,
                  ]
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
