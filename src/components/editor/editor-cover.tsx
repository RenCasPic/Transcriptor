'use client';

import { useRef, useState } from 'react';
import { Captions, ImagePlus, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { setCoverImageAction, updateCoverAltAction } from '@/lib/actions/images';
import { createVersionAction } from '@/lib/actions/versions';
import { ImageUploadError, uploadImageFile } from '@/lib/images/client-upload';
import { COVER_IMAGE_KEY } from '@/lib/images/limits';
import { MEDIA_UPLOAD_ACCEPT } from '@/lib/images/accept';
import { ImageGenerateDialog, type GeneratedImageChoice } from './image-generate-dialog';
import { ImageAltDialog } from './image-alt-dialog';

export interface CoverState {
  url: string | null;
  alt: string | null;
  prompt: string | null;
}

const ACTION_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-md border bg-background/95 px-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * Portada del artículo en el editor: banner con "Regenerar portada", "Subir
 * portada" y "Editar texto alternativo" al pasar el cursor. Si no hay portada,
 * muestra los botones para añadir una. Cada cambio queda en el historial.
 */
export function EditorCover({
  documentId,
  projectId,
  workspaceId,
  title,
  imagesAvailable,
  cover,
  onChange,
}: {
  documentId: string;
  projectId: string;
  workspaceId: string;
  title: string;
  imagesAvailable: boolean;
  cover: CoverState;
  onChange: (cover: CoverState) => void;
}) {
  const t = useDictionary();
  const labels = t.editor.images;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<'regenerate' | 'alt' | null>(null);
  const [uploading, setUploading] = useState(false);

  async function applyCover(next: { url: string; alt: string; prompt: string | null }) {
    const result = await setCoverImageAction({ documentId, ...next });
    if (!result.success) {
      toast.error(result.error.message);
      return false;
    }
    onChange(next);
    toast.success(labels.cover.updated);
    return true;
  }

  async function handleAccept(choice: GeneratedImageChoice) {
    await applyCover({ url: choice.url, alt: choice.alt || cover.alt || title, prompt: choice.prompt });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImageFile(file, { workspaceId, projectId });
      await applyCover({ url, alt: cover.alt || title, prompt: null });
    } catch (error) {
      const code = error instanceof ImageUploadError ? error.code : 'UPLOAD';
      toast.error(code === 'TYPE' ? labels.uploadTypeError : code === 'SIZE' ? labels.uploadSizeError : labels.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveAlt(alt: string) {
    const result = await updateCoverAltAction({ documentId, alt });
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    onChange({ ...cover, alt });
    void createVersionAction({ documentId, reason: labels.versionAlt });
  }

  const regenerateButton = (
    <button
      type="button"
      className={ACTION_BUTTON}
      onClick={() => setDialog('regenerate')}
      title={imagesAvailable ? undefined : labels.unavailableHint}
      aria-label={cover.url ? labels.cover.regenerate : labels.cover.add}
    >
      {cover.url ? <RefreshCw className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
      <span className={cover.url ? 'hidden sm:inline' : undefined}>
        {cover.url ? labels.cover.regenerate : labels.cover.add}
      </span>
    </button>
  );
  const uploadButton = (
    <button
      type="button"
      className={ACTION_BUTTON}
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      aria-label={labels.cover.upload}
    >
      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      <span className={cover.url ? 'hidden sm:inline' : undefined}>
        {uploading ? labels.uploading : labels.cover.upload}
      </span>
    </button>
  );

  return (
    <>
      {cover.url ? (
        <div className="group relative mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            alt={cover.alt ?? ''}
            className="aspect-[16/6] w-full rounded-lg border object-cover"
          />
          <div
            role="group"
            aria-label={labels.imageControls}
            className={cn(
              'absolute inset-x-2 top-2 flex flex-wrap justify-end gap-1.5 opacity-0 transition-opacity',
              'group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
            )}
          >
            {regenerateButton}
            {uploadButton}
            <button
              type="button"
              className={ACTION_BUTTON}
              onClick={() => setDialog('alt')}
              aria-label={labels.cover.editAlt}
              title={labels.cover.editAlt}
            >
              <Captions className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{labels.cover.editAlt}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {regenerateButton}
          {uploadButton}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={MEDIA_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void handleFile(file);
        }}
      />

      <ImageGenerateDialog
        open={dialog === 'regenerate'}
        onOpenChange={(open) => !open && setDialog(null)}
        documentId={documentId}
        imageKey={COVER_IMAGE_KEY}
        replacesCurrent={!!cover.url}
        title={labels.cover.regenerateTitle}
        description={labels.cover.regenerateDescription}
        initialPrompt={cover.prompt || `${labels.cover.defaultPrompt}: ${title}`}
        initialAlt={cover.alt || title}
        imagesAvailable={imagesAvailable}
        onAccept={handleAccept}
      />

      <ImageAltDialog
        open={dialog === 'alt'}
        onOpenChange={(open) => !open && setDialog(null)}
        initialAlt={cover.alt ?? ''}
        onSave={handleSaveAlt}
      />
    </>
  );
}
