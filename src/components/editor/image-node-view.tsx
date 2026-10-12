'use client';

import { useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Captions, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { ImageUploadError, uploadImageFile } from '@/lib/images/client-upload';
import { MEDIA_UPLOAD_ACCEPT } from '@/lib/images/accept';
import { useEditorImageContext } from './image-context';
import { ImageGenerateDialog } from './image-generate-dialog';
import { ImageAltDialog } from './image-alt-dialog';

const ACTION_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-md border bg-background/95 px-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * Vista de una imagen del artículo dentro del editor. Al pasar el cursor (o
 * seleccionarla / en pantallas táctiles) muestra: Regenerar, Reemplazar, Editar
 * texto alternativo y Eliminar. Cada cambio dispara el autoguardado y deja una
 * entrada en el historial de versiones (vía `commitImageChange`).
 */
export function ImageNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const t = useDictionary();
  const ctx = useEditorImageContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<'regenerate' | 'alt' | null>(null);
  const [uploading, setUploading] = useState(false);

  const src = String(node.attrs.src ?? '');
  const alt = String(node.attrs.alt ?? '');
  const prompt = String(node.attrs.prompt ?? '');
  const editable = editor.isEditable;
  const labels = t.editor.images;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImageFile(file, { workspaceId: ctx.workspaceId, projectId: ctx.projectId });
      updateAttributes({ src: url, prompt: null });
      ctx.commitImageChange(labels.versionReplaced);
      toast.success(labels.updated);
    } catch (error) {
      const code = error instanceof ImageUploadError ? error.code : 'UPLOAD';
      toast.error(code === 'TYPE' ? labels.uploadTypeError : code === 'SIZE' ? labels.uploadSizeError : labels.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <NodeViewWrapper className="article-image group relative my-6" data-drag-handle>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn('block w-full rounded-lg border object-cover', selected && 'ring-2 ring-primary')}
      />

      {editable && (
        <div
          contentEditable={false}
          role="group"
          aria-label={labels.imageControls}
          className={cn(
            'absolute inset-x-2 top-2 flex flex-wrap justify-end gap-1.5 opacity-0 transition-opacity',
            'group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
            selected && 'opacity-100',
          )}
        >
          <button
            type="button"
            className={ACTION_BUTTON}
            onClick={() => setDialog('regenerate')}
            title={ctx.imagesAvailable ? labels.regenerate : labels.unavailableHint}
            aria-label={labels.regenerate}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{labels.regenerate}</span>
          </button>
          <button
            type="button"
            className={ACTION_BUTTON}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title={labels.replace}
            aria-label={labels.replace}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{uploading ? labels.uploading : labels.replace}</span>
          </button>
          <button
            type="button"
            className={ACTION_BUTTON}
            onClick={() => setDialog('alt')}
            title={labels.editAlt}
            aria-label={labels.editAlt}
          >
            <Captions className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{labels.editAlt}</span>
          </button>
          <button
            type="button"
            className={cn(ACTION_BUTTON, 'text-destructive')}
            title={labels.remove}
            aria-label={labels.remove}
            onClick={() => {
              deleteNode();
              ctx.commitImageChange(labels.versionRemoved);
              toast.success(labels.removed);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{labels.remove}</span>
          </button>
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
        </div>
      )}

      <ImageGenerateDialog
        open={dialog === 'regenerate'}
        onOpenChange={(open) => !open && setDialog(null)}
        documentId={ctx.documentId}
        title={labels.regenerateTitle}
        description={labels.regenerateDescription}
        initialPrompt={prompt || alt}
        initialAlt={alt}
        imagesAvailable={ctx.imagesAvailable}
        onAccept={(choice) => {
          updateAttributes({ src: choice.url, prompt: choice.prompt, alt: choice.alt || alt });
          ctx.commitImageChange(labels.versionRegenerated);
          toast.success(labels.updated);
        }}
      />

      <ImageAltDialog
        open={dialog === 'alt'}
        onOpenChange={(open) => !open && setDialog(null)}
        initialAlt={alt}
        onSave={(next) => {
          updateAttributes({ alt: next });
          ctx.commitImageChange(labels.versionAlt);
        }}
      />
    </NodeViewWrapper>
  );
}
