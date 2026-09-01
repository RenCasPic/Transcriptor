'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Film, Link2, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArticleConfigFields } from './article-config-fields';
import { ImportErrorPanel } from './import-error-panel';
import { youtubeImportErrorPresentation } from './youtube-import-error-presentation';
import { MediaProcessingStatus } from '@/components/projects/media-processing-status';
import { ArticleConfigSchema, type ArticleConfigInput } from '@/lib/validations/project';
import {
  createQuickProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from '@/lib/actions/projects';
import { generateArticleAction } from '@/lib/actions/generation';
import { useMediaUpload } from '@/lib/media/use-media-upload';
import { useYoutubeImport } from '@/lib/youtube/use-youtube-import';
import {
  MEDIA_ACCEPT_ATTR,
  MEDIA_EXTENSIONS_LABEL,
  mediaFormatForExtension,
  extensionOf,
} from '@/lib/media/formats';
import type { MediaLimits } from '@/lib/media/limits';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

type ContentSource = 'upload' | 'url';

/**
 * "Crea tu artículo" — un ÚNICO formulario de configuración del artículo con
 * DOS métodos para aportar el contenido (subir un video o pegar un enlace).
 *
 * La configuración del artículo (`useForm<ArticleConfigInput>`) vive una sola
 * vez aquí y se comparte entre ambos métodos; cambiar de método NO toca esos
 * campos ni el archivo/enlace ya introducido. La lógica de subida
 * (`useMediaUpload`), la de import de YouTube (`useYoutubeImport`), las
 * validaciones y las Server Actions se reutilizan sin cambios.
 */
export function CreateArticlePanel({ mediaLimits }: { mediaLimits: MediaLimits }) {
  const t = useDictionary();
  const router = useRouter();

  // --- Estado de la FUENTE (independiente de la configuración del artículo) ---
  const [source, setSource] = useState<ContentSource>('upload');

  // Subir video
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [active, setActive] = useState<{ projectId: string; jobId: string | null } | null>(null);
  const { phase, progress, start } = useMediaUpload();

  // Pegar enlace
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlError, setUrlError] = useState<{ code: string; message: string } | null>(null);
  const { stage, run } = useYoutubeImport();

  // --- Configuración del artículo: UNA sola instancia, compartida ---
  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useForm<ArticleConfigInput>({
    resolver: zodResolver(ArticleConfigSchema),
    defaultValues: { contentType: 'guide', tone: 'professional', targetReadingMinutes: null },
  });

  const maxMb = Math.round(mediaLimits.maxSourceBytes / (1024 * 1024));
  const uploadBusy = active !== null && phase !== 'error';
  const isBusy = uploadBusy || isSubmitting;
  const canGenerate = source === 'upload' ? selectedFile !== null : videoUrl.trim().length > 0;

  /** Valida el archivo (mismos criterios que antes) y lo deja listo, sin subirlo aún. */
  function pickFile(file: File | undefined | null) {
    if (!file) return;
    if (!mediaFormatForExtension(extensionOf(file.name))) {
      toast.error(t.projects.source.mediaErrors.UNSUPPORTED_MEDIA_FORMAT);
      return;
    }
    if (file.size > mediaLimits.maxSourceBytes) {
      toast.error(
        (t.projects.source.mediaErrors as Record<string, string>).MEDIA_SOURCE_TOO_LARGE ??
          t.projects.source.mediaErrors.default,
      );
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    pickFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (isBusy) return;
    pickFile(e.dataTransfer.files?.[0]);
  }

  /** Sube el archivo ya seleccionado — lógica de subida original, intacta. */
  async function generateFromUpload() {
    if (!selectedFile) return;
    setUploadError(null);

    const projectResult = await createQuickProjectAction({ source: 'upload', ...getValues() });
    if (!projectResult.success) {
      toast.error(projectResult.error.message);
      return;
    }
    const projectId = projectResult.data.id;
    setActive({ projectId, jobId: null });

    const result = await start({
      projectId,
      file: selectedFile,
      language: 'es',
      maxUploadBytes: mediaLimits.maxUploadBytes,
      maxSourceBytes: mediaLimits.maxSourceBytes,
      clientExtractThresholdBytes: mediaLimits.clientExtractThresholdBytes,
    });
    if (!result.success) {
      await deleteProjectAction(projectId);
      setActive(null);
      setUploadError(
        (t.projects.source.mediaErrors as Record<string, string>)[result.error.code] ??
          t.projects.source.mediaErrors.default,
      );
      return;
    }
    setActive({ projectId, jobId: result.data.jobId });
  }

  /** Import de YouTube + generación — lógica original, intacta. */
  async function generateFromUrl() {
    if (!videoUrl.trim()) return;

    setUrlError(null);
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
        await deleteProjectAction(projectId);
        setUrlError({ code: result.error.code, message: result.error.message });
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
      router.push(`/projects/${projectId}/editor`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGenerate() {
    if (source === 'upload') {
      void generateFromUpload();
    } else {
      void generateFromUrl();
    }
  }

  return (
    <Card>
      <CardContent className="space-y-8 p-6 sm:p-8">
        {/* ============ SECCIÓN 1 — AÑADE TU CONTENIDO ============ */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.dashboard.addContentTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.addContentHint}</p>
          </div>

          {/* Segmented control: dos métodos para la misma configuración */}
          <div
            role="tablist"
            aria-label={t.dashboard.addContentTitle}
            className="grid grid-cols-2 gap-1 rounded-lg border border-primary/30 bg-muted/60 p-1"
          >
            <SourceTab
              icon={<Film className="h-4 w-4" />}
              label={t.dashboard.sourceUploadTab}
              selected={source === 'upload'}
              onClick={() => setSource('upload')}
            />
            <SourceTab
              icon={<Link2 className="h-4 w-4" />}
              label={t.dashboard.sourceUrlTab}
              selected={source === 'url'}
              onClick={() => setSource('url')}
            />
          </div>

          {/* Área de entrada dinámica: NUNCA se muestran las dos a la vez */}
          {source === 'upload' ? (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={MEDIA_ACCEPT_ATTR}
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isBusy && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isBusy) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-primary/40 bg-muted/30 hover:border-primary/60 hover:bg-muted/50',
                  isBusy && 'pointer-events-none opacity-60',
                )}
              >
                <UploadCloud className="h-7 w-7 text-primary" />
                {selectedFile ? (
                  <>
                    <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · {t.dashboard.dropzoneChange}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">{t.dashboard.dropzonePrompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.projects.source.mediaFormats} {t.projects.source.mediaMaxSize}: {maxMb} MB.
                    </p>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t.projects.source.mediaAsyncNote}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="video-url">{t.dashboard.videoUrlLabel}</Label>
              <Input
                id="video-url"
                inputMode="url"
                placeholder={t.projects.source.youtubeUrlPlaceholder}
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isSubmitting}
              />
              {isSubmitting && stage !== 'idle' && (
                <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t.projects.source.youtubeStages[stage]}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="border-t border-border" />

        {/* ============ SECCIÓN 2 — PERSONALIZA TU ARTÍCULO ============ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.dashboard.customizeTitle}
          </h2>
          <ArticleConfigFields idPrefix="article" register={register} control={control} errors={errors} />
        </section>

        {/* Progreso / errores — compartidos, según el método activo */}
        {active && (
          <MediaProcessingStatus
            jobId={active.jobId}
            projectId={active.projectId}
            clientPhase={phase}
            uploadProgress={progress}
            onDismiss={() => {
              const projectId = active.projectId;
              setActive(null);
              router.push(`/projects/${projectId}`);
            }}
          />
        )}

        {uploadError && (
          <ImportErrorPanel
            title={t.dashboard.importError.title}
            message={uploadError}
            dismissLabel={t.dashboard.importError.dismiss}
            onDismiss={() => setUploadError(null)}
            tips={[
              `${t.dashboard.importError.uploadTip1} (${MEDIA_EXTENSIONS_LABEL})`,
              t.dashboard.importError.uploadTip2,
              t.dashboard.importError.uploadTip3,
            ]}
          />
        )}

        {urlError &&
          (() => {
            const { title, tips } = youtubeImportErrorPresentation(urlError.code, t.dashboard.importError);
            return (
              <ImportErrorPanel
                title={title}
                message={urlError.message}
                dismissLabel={t.dashboard.importError.dismiss}
                onDismiss={() => setUrlError(null)}
                tips={tips}
              />
            );
          })()}

        {/* ============ BOTÓN ÚNICO ============ */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleGenerate}
          disabled={!canGenerate || isBusy}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.dashboard.generateArticle}
        </Button>
      </CardContent>
    </Card>
  );
}

function SourceTab({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        selected
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
