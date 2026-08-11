'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Sparkles, Youtube, Film, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportErrorPanel } from '@/components/dashboard/import-error-panel';
import { importTranscriptAction } from '@/lib/actions/projects';
import { transcribeMediaAction, importMediaFromUrlAction } from '@/lib/actions/transcription';
import { generateArticleAction } from '@/lib/actions/generation';
import { useYoutubeImport } from '@/lib/youtube/use-youtube-import';
import { createClient } from '@/lib/supabase/client';
import { DEMO_TRANSCRIPT_TEXT } from '@/lib/content/demo-transcript';
import { sanitizeFilename } from '@/lib/content/slug';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const EXTENSION_TO_SOURCE: Record<string, 'txt' | 'srt' | 'vtt'> = {
  txt: 'txt',
  srt: 'srt',
  vtt: 'vtt',
};

const MEDIA_EXTENSION_TO_TYPE: Record<string, 'video' | 'audio'> = {
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
};

const VALID_TABS = ['paste', 'upload', 'media', 'youtube', 'demo'] as const;
type SourceTab = (typeof VALID_TABS)[number];

export function ContentSourcePanel({
  projectId,
  workspaceId,
  language,
  initialTab,
}: {
  projectId: string;
  workspaceId: string;
  language: string;
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isImportingYoutube, setIsImportingYoutube] = useState(false);
  const [youtubeImportError, setYoutubeImportError] = useState<{ code: string; message: string } | null>(null);
  const { stage: youtubeStage, run: runYoutubeImport } = useYoutubeImport();

  /**
   * Encadena la generación del artículo (con su SEO) justo después de
   * importar cualquier fuente, para que el usuario nunca tenga que pulsar
   * "Generar artículo" a mano. Si la generación falla, se queda en esta
   * página (con la transcripción ya importada) para reintentar desde
   * `GenerateArticlePanel`.
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

  async function handleMediaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    setIsTranscribing(true);
    try {
      const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${sanitizeFilename(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('project-sources')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError);
        toast.error(`${t.projects.source.mediaUploadError} (${uploadError.message})`);
        return;
      }

      const result = await transcribeMediaAction({
        projectId,
        sourceType: mediaType,
        storagePath,
        originalFilename: file.name,
        language,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      toast.success(t.projects.source.transcribeSuccess);
      await generateAndRedirect();
    } catch {
      toast.error(t.projects.source.mediaProcessError);
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleUseDemo() {
    await handleImport({ sourceType: 'manual', text: DEMO_TRANSCRIPT_TEXT });
  }

  async function handleImportFromUrl() {
    if (!mediaUrl.trim()) return;

    setIsImportingUrl(true);
    try {
      const result = await importMediaFromUrlAction({ projectId, sourceUrl: mediaUrl.trim(), language });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      toast.success(t.projects.source.transcribeSuccess);
      setMediaUrl('');
      await generateAndRedirect();
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
      if (result.data.isDemo) {
        toast.info(t.projects.source.youtubeDemoModeNotice);
      }
      setYoutubeUrl('');
      await generateAndRedirect();
    } finally {
      setIsImportingYoutube(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue={VALID_TABS.includes(initialTab as SourceTab) ? (initialTab as SourceTab) : 'paste'}>
        <TabsList>
          <TabsTrigger value="paste">{t.projects.source.pasteTab}</TabsTrigger>
          <TabsTrigger value="upload">{t.projects.source.uploadTab}</TabsTrigger>
          <TabsTrigger value="media">{t.projects.source.mediaTab}</TabsTrigger>
          <TabsTrigger value="youtube">{t.projects.source.youtubeTab}</TabsTrigger>
          <TabsTrigger value="demo">{t.projects.source.demoTab}</TabsTrigger>
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
          <p className="text-sm text-muted-foreground">{t.projects.source.mediaFormats}</p>
          <input
            ref={mediaInputRef}
            type="file"
            accept=".mp4,.mov,.webm,.mp3,.wav,.m4a"
            className="hidden"
            onChange={handleMediaFileChange}
          />
          <Button
            variant="outline"
            onClick={() => mediaInputRef.current?.click()}
            disabled={isTranscribing}
          >
            {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {isTranscribing ? t.projects.source.transcribing : t.projects.source.selectMedia}
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
              disabled={isImportingUrl}
            />
            <Button
              variant="outline"
              onClick={handleImportFromUrl}
              disabled={isImportingUrl || !mediaUrl.trim()}
            >
              {isImportingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t.projects.source.useLink}
            </Button>
          </div>
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

        <TabsContent value="demo" className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.projects.source.demoDescription}</p>
          <Button onClick={handleUseDemo} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t.projects.source.useDemoTranscript}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
