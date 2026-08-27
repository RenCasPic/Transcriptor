'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Youtube, Film, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportErrorPanel } from '@/components/dashboard/import-error-panel';
import { MediaProcessingStatus } from '@/components/projects/media-processing-status';
import { importTranscriptAction } from '@/lib/actions/projects';
import { importMediaFromUrlAction } from '@/lib/actions/transcription';
import { generateArticleAction } from '@/lib/actions/generation';
import { useYoutubeImport } from '@/lib/youtube/use-youtube-import';
import { useMediaUpload } from '@/lib/media/use-media-upload';
import { createClient } from '@/lib/supabase/client';
import { sanitizeFilename } from '@/lib/content/slug';
import { MEDIA_ACCEPT_ATTR, validateMediaUpload } from '@/lib/media/formats';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const EXTENSION_TO_SOURCE: Record<string, 'txt' | 'srt' | 'vtt'> = {
  txt: 'txt',
  srt: 'srt',
  vtt: 'vtt',
};

const VALID_TABS = ['paste', 'upload', 'media', 'youtube'] as const;
type SourceTab = (typeof VALID_TABS)[number];

export function ContentSourcePanel({
  projectId,
  workspaceId,
  language,
  maxUploadBytes,
  initialTab,
}: {
  projectId: string;
  workspaceId: string;
  language: string;
  maxUploadBytes: number;
  initialTab?: string;
}) {
  const router = useRouter();
  const t = useDictionary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isImportingYoutube, setIsImportingYoutube] = useState(false);
  const [youtubeImportError, setYoutubeImportError] = useState<{ code: string; message: string } | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const { stage: youtubeStage, run: runYoutubeImport } = useYoutubeImport();
  const { phase: uploadPhase, progress: uploadProgress, start: startUpload } = useMediaUpload();

  const maxMb = Math.round(maxUploadBytes / (1024 * 1024));

  /**
   * Encadena la generación del artículo (con su SEO) justo después de
   * importar una fuente de TEXTO. Para audio/video la generación la encadena
   * el propio job de transcripción (`autoGenerate`), así que ese camino no
   * llama aquí.
   */
  async function generateAndRedirect() {
    const generationResult = await generateArticleAction(projectId);
    if (!generationResult.success) {
      toast.error(generationResult.error.message);
      router.refresh();
      return;
    }
    router.push(`/projects/${projectId}/editor`);
  }

  async function handleImport(params: {
    sourceType: 'manual' | 'txt' | 'srt' | 'vtt';
    text: string;
    originalFilename?: string;
    storagePath?: string;
  }) {
    setIsSubmitting(true);
    try {
      const result = await importTranscriptAction({
        projectId,
        sourceType: params.sourceType,
        text: params.text,
        originalFilename: params.originalFilename,
        storagePath: params.storagePath,
        language,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      toast.success(t.projects.source.importSuccess);
      await generateAndRedirect();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasteSubmit() {
    await handleImport({ sourceType: 'manual', text: pastedText });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const sourceType = EXTENSION_TO_SOURCE[extension];
    if (!sourceType) {
      toast.error(t.projects.source.unsupportedTextFormat);
      return;
    }
    if (file.size > MAX_TEXT_FILE_SIZE_BYTES) {
      toast.error(t.projects.source.textFileTooLarge);
      return;
    }

    setIsSubmitting(true);
    try {
      const text = await file.text();
      const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${sanitizeFilename(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('project-sources')
        .upload(storagePath, file, { contentType: file.type || 'text/plain' });

      if (uploadError) {
        toast.error(t.projects.source.originalFileSaveError);
      }

      await handleImport({
        sourceType,
        text,
        originalFilename: file.name,
        storagePath: uploadError ? undefined : storagePath,
      });
    } catch {
      toast.error(t.projects.source.fileReadError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function mediaErrorMessage(code: string): string {
    return (
      (t.projects.source.mediaErrors as Record<string, string>)[code] ?? t.projects.source.mediaErrors.default
    );
  }

  async function handleMediaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      toast.error(mediaErrorMessage(check.code));
      return;
    }

    setMediaError(null);
    setActiveJobId(null);
    setIsUploadingMedia(true);
    try {
      const result = await startUpload({ projectId, file, language, maxUploadBytes });
      if (!result.success) {
        setMediaError(mediaErrorMessage(result.error.code));
        return;
      }
      setActiveJobId(result.data.jobId);
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function handleImportFromUrl() {
    if (!mediaUrl.trim()) return;

    setMediaError(null);
    setActiveJobId(null);
    setIsImportingUrl(true);
    try {
      const result = await importMediaFromUrlAction({ projectId, sourceUrl: mediaUrl.trim(), language });
      if (!result.success) {
        setMediaError(mediaErrorMessage(result.error.code));
        return;
      }
      setMediaUrl('');
      setActiveJobId(result.data.jobId);
    } finally {
      setIsImportingUrl(false);
    }
  }

  async function handleYoutubeImport() {
    if (!youtubeUrl.trim()) return;

    setYoutubeImportError(null);
    setIsImportingYoutube(true);
    try {
      const result = await runYoutubeImport({ projectId, videoUrl: youtubeUrl.trim(), language });

      if (!result.success) {
        setYoutubeImportError({ code: result.error.code, message: result.error.message });
        return;
      }

      toast.success(t.projects.source.youtubeImportSuccess);
      setYoutubeUrl('');
      await generateAndRedirect();
    } finally {
      setIsImportingYoutube(false);
    }
  }

  const mediaBusy = isUploadingMedia || activeJobId !== null || isImportingUrl;

  return (
    <div className="space-y-4">
      <Tabs defaultValue={VALID_TABS.includes(initialTab as SourceTab) ? (initialTab as SourceTab) : 'paste'}>
        <TabsList>
          <TabsTrigger value="paste">{t.projects.source.pasteTab}</TabsTrigger>
          <TabsTrigger value="upload">{t.projects.source.uploadTab}</TabsTrigger>
          <TabsTrigger value="media">{t.projects.source.mediaTab}</TabsTrigger>
          <TabsTrigger value="youtube">{t.projects.source.youtubeTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-3">
          <Textarea
            rows={8}
            placeholder={t.projects.source.pastePlaceholder}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <Button onClick={handlePasteSubmit} disabled={isSubmitting || pastedText.trim().length < 20}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.projects.source.useThisTranscript}
          </Button>
        </TabsContent>

        <TabsContent value="upload" className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.projects.source.uploadFormats}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.srt,.vtt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t.projects.source.selectFile}
          </Button>
        </TabsContent>

        <TabsContent value="media" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t.projects.source.mediaFormats} {t.projects.source.mediaMaxSize}: {maxMb} MB.
          </p>
          <p className="text-xs text-muted-foreground">{t.projects.source.mediaAsyncNote}</p>
          <input
            ref={mediaInputRef}
            type="file"
            accept={MEDIA_ACCEPT_ATTR}
            className="hidden"
            onChange={handleMediaFileChange}
          />
          <Button variant="outline" onClick={() => mediaInputRef.current?.click()} disabled={mediaBusy}>
            {mediaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {t.projects.source.selectMedia}
          </Button>

          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t.projects.source.orPasteLink}
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-xs text-muted-foreground">{t.projects.source.linkHint}</p>
          <div className="flex gap-2">
            <Input
              placeholder={t.projects.source.linkPlaceholder}
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              disabled={mediaBusy}
            />
            <Button variant="outline" onClick={handleImportFromUrl} disabled={mediaBusy || !mediaUrl.trim()}>
              {isImportingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t.projects.source.useLink}
            </Button>
          </div>

          {(isUploadingMedia || activeJobId) && (
            <MediaProcessingStatus
              jobId={activeJobId}
              projectId={projectId}
              isUploading={
                isUploadingMedia ||
                uploadPhase === 'uploading' ||
                uploadPhase === 'preparing' ||
                uploadPhase === 'enqueuing'
              }
              uploadProgress={uploadProgress}
              onDismiss={() => {
                setActiveJobId(null);
                router.refresh();
              }}
            />
          )}
          {mediaError && (
            <ImportErrorPanel
              title={t.projects.source.mediaProcessing.errorTitle}
              message={mediaError}
              dismissLabel={t.dashboard.importError.dismiss}
              onDismiss={() => setMediaError(null)}
              tips={[
                t.projects.source.mediaProcessing.errorTip1,
                t.projects.source.mediaProcessing.errorTip2,
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="youtube" className="space-y-3">
          <p className="text-xs text-muted-foreground">{t.projects.source.youtubeUrlHint}</p>
          <div className="flex gap-2">
            <Input
              placeholder={t.projects.source.youtubeUrlPlaceholder}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={isImportingYoutube}
            />
            <Button onClick={handleYoutubeImport} disabled={isImportingYoutube || !youtubeUrl.trim()}>
              {isImportingYoutube ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
              {t.projects.source.useLink}
            </Button>
          </div>
          {isImportingYoutube && youtubeStage !== 'idle' && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t.projects.source.youtubeStages[youtubeStage]}
            </p>
          )}
          {youtubeImportError && (
            <ImportErrorPanel
              title={
                youtubeImportError.code === 'YOUTUBE_EXTRACTOR_INCOMPATIBLE'
                  ? t.dashboard.importError.extractorIncompatibleTitle
                  : t.dashboard.importError.title
              }
              message={youtubeImportError.message}
              dismissLabel={t.dashboard.importError.dismiss}
              onDismiss={() => setYoutubeImportError(null)}
              tips={
                youtubeImportError.code === 'YOUTUBE_EXTRACTOR_INCOMPATIBLE'
                  ? [t.dashboard.importError.extractorIncompatibleTip1, t.dashboard.importError.extractorIncompatibleTip2]
                  : [
                      t.dashboard.importError.youtubeTip1,
                      t.dashboard.importError.youtubeTip2,
                      t.dashboard.importError.youtubeTip3,
                    ]
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
