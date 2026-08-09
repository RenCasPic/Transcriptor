'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Film, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArticleConfigFields } from './article-config-fields';
import { ImportErrorPanel } from './import-error-panel';
import { ArticleConfigSchema, type ArticleConfigInput } from '@/lib/validations/project';
import { createQuickProjectAction, deleteProjectAction } from '@/lib/actions/projects';
import { transcribeMediaAction } from '@/lib/actions/transcription';
import { generateArticleAction } from '@/lib/actions/generation';
import { createClient } from '@/lib/supabase/client';
import { sanitizeFilename } from '@/lib/content/slug';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const MAX_MEDIA_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const MEDIA_EXTENSION_TO_TYPE: Record<string, 'video' | 'audio'> = {
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
};

export function UploadVideoCard({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const t = useDictionary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<ArticleConfigInput>({
    resolver: zodResolver(ArticleConfigSchema),
    defaultValues: { contentType: 'guide', tone: 'professional' },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mediaType = MEDIA_EXTENSION_TO_TYPE[extension];
    if (!mediaType) {
      toast.error(t.projects.source.unsupportedMediaFormat);
      return;
    }
    if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
      toast.error(t.projects.source.mediaFileTooLarge);
      return;
    }

    setImportError(null);
    setIsSubmitting(true);
    let createdProjectId: string | null = null;
    try {
      const projectResult = await createQuickProjectAction({ source: 'upload', ...getValues() });
      if (!projectResult.success) {
        toast.error(projectResult.error.message);
        return;
      }
      const projectId = projectResult.data.id;
      createdProjectId = projectId;

      const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${sanitizeFilename(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('project-sources')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError);
        setImportError(`${t.projects.source.mediaUploadError} (${uploadError.message})`);
        return;
      }

      const result = await transcribeMediaAction({
        projectId,
        sourceType: mediaType,
        storagePath,
        originalFilename: file.name,
        language: 'es',
      });

      if (!result.success) {
        setImportError(result.error.message);
        return;
      }

      createdProjectId = null; // ya hay una transcripción válida: no se debe borrar el proyecto.
      const generationResult = await generateArticleAction(projectId);
      if (!generationResult.success) {
        toast.error(generationResult.error.message);
        router.push(`/projects/${projectId}`);
        return;
      }

      toast.success(t.projects.source.transcribeSuccess);
      router.push(`/projects/${projectId}/editor`);
    } catch {
      setImportError(t.projects.source.mediaProcessError);
    } finally {
      // El proyecto rápido no tiene ningún contenido útil si la subida o la
      // transcripción fallaron: se elimina en vez de dejarlo como un
      // proyecto "Fallido" huérfano en la lista del usuario.
      if (createdProjectId) {
        await deleteProjectAction(createdProjectId);
      }
      setIsSubmitting(false);
    }
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
          accept=".mp4,.mov,.webm,.mp3,.wav,.m4a"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          {t.dashboard.uploadFile}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t.projects.source.mediaFormats}</p>
        <ArticleConfigFields idPrefix="upload" register={register} control={control} errors={errors} />
        {importError && (
          <ImportErrorPanel
            title={t.dashboard.importError.title}
            message={importError}
            dismissLabel={t.dashboard.importError.dismiss}
            onDismiss={() => setImportError(null)}
            tips={[
              t.dashboard.importError.uploadTip1,
              t.dashboard.importError.uploadTip2,
              t.dashboard.importError.uploadTip3,
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
