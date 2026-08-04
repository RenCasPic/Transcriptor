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
import { ArticleConfigSchema, type ArticleConfigInput } from '@/lib/validations/project';
import { createQuickProjectAction, updateProjectAction } from '@/lib/actions/projects';
import { importYoutubeVideoAction } from '@/lib/actions/youtube';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function YoutubeUrlCard() {
  const router = useRouter();
  const t = useDictionary();
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setIsSubmitting(true);
    try {
      const projectResult = await createQuickProjectAction({ source: 'youtube', ...getValues() });
      if (!projectResult.success) {
        toast.error(projectResult.error.message);
        return;
      }
      const projectId = projectResult.data.id;

      const result = await importYoutubeVideoAction({ projectId, videoUrl: videoUrl.trim(), language: 'es' });
      if (!result.success) {
        toast.error(result.error.message);
        router.push(`/projects/${projectId}?tab=youtube`);
        return;
      }

      await updateProjectAction(projectId, { name: result.data.title });
      toast.success(t.projects.source.youtubeImportSuccess);
      router.push(`/projects/${projectId}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Youtube className="h-4 w-4" />
          {t.dashboard.connectYoutube}
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
            {t.dashboard.connectYoutube}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
