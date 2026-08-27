'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Film, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArticleConfigFields } from './article-config-fields';
import { ImportErrorPanel } from './import-error-panel';
import { MediaProcessingStatus } from '@/components/projects/media-processing-status';
import { ArticleConfigSchema, type ArticleConfigInput } from '@/lib/validations/project';
import { createQuickProjectAction, deleteProjectAction } from '@/lib/actions/projects';
import { useMediaUpload } from '@/lib/media/use-media-upload';
import { MEDIA_ACCEPT_ATTR, MEDIA_EXTENSIONS_LABEL, validateMediaUpload } from '@/lib/media/formats';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function UploadVideoCard({ maxUploadBytes }: { maxUploadBytes: number }) {
  const t = useDictionary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [active, setActive] = useState<{ projectId: string; jobId: string | null } | null>(null);
  const { phase, progress, start } = useMediaUpload();
  const maxMb = Math.round(maxUploadBytes / (1024 * 1024));

  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<ArticleConfigInput>({
    resolver: zodResolver(ArticleConfigSchema),
    defaultValues: { contentType: 'guide', tone: 'professional' },
  });

  const isBusy = active !== null && phase !== 'error';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const check = validateMediaUpload({
      filename: file.name,
      contentType: file.type || null,
      sizeBytes: file.size,
      maxUploadBytes,
    });
    if (!check.ok) {
      toast.error(
        (t.projects.source.mediaErrors as Record<string, string>)[check.code] ??
          t.projects.source.mediaErrors.default,
      );
      return;
    }

    setImportError(null);
    const projectResult = await createQuickProjectAction({ source: 'upload', ...getValues() });
    if (!projectResult.success) {
      toast.error(projectResult.error.message);
      return;
    }
    const projectId = projectResult.data.id;
    setActive({ projectId, jobId: null });

    const result = await start({ projectId, file, language: 'es', maxUploadBytes });
    if (!result.success) {
      await deleteProjectAction(projectId);
      setActive(null);
      setImportError(
        (t.projects.source.mediaErrors as Record<string, string>)[result.error.code] ??
          t.projects.source.mediaErrors.default,
      );
      return;
    }
    setActive({ projectId, jobId: result.data.jobId });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-4 w-4" />
          {t.dashboard.uploadFile}
        </CardTitle>
        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT_ATTR}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          {t.dashboard.uploadFile}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t.projects.source.mediaFormats} {t.projects.source.mediaMaxSize}: {maxMb} MB.
        </p>
        <p className="text-xs text-muted-foreground">{t.projects.source.mediaAsyncNote}</p>
        <ArticleConfigFields idPrefix="upload" register={register} control={control} errors={errors} />

        {active && (
          <MediaProcessingStatus
            jobId={active.jobId}
            projectId={active.projectId}
            isUploading={phase === 'uploading' || phase === 'preparing' || phase === 'enqueuing'}
            uploadProgress={progress}
            onDismiss={() => setActive(null)}
          />
        )}

        {importError && (
          <ImportErrorPanel
            title={t.dashboard.importError.title}
            message={importError}
            dismissLabel={t.dashboard.importError.dismiss}
            onDismiss={() => setImportError(null)}
            tips={[
              `${t.dashboard.importError.uploadTip1} (${MEDIA_EXTENSIONS_LABEL})`,
              t.dashboard.importError.uploadTip2,
              t.dashboard.importError.uploadTip3,
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
