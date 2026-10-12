'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Undo2, Redo2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BlockId } from '@/lib/editor/block-id-extension';
import { ArticleImage } from './article-image-extension';
import { EditorCover, type CoverState } from './editor-cover';
import { EditorImageProvider } from './image-context';
import { ImageGenerateDialog } from './image-generate-dialog';
import { ImageUploadError, uploadImageFile } from '@/lib/images/client-upload';
import { MEDIA_UPLOAD_ACCEPT } from '@/lib/images/accept';
import { useAutosave, type AutosaveStatus } from '@/lib/editor/use-autosave';
import { countWords, estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { rewriteSectionAction } from '@/lib/actions/editor';
import { createVersionAction } from '@/lib/actions/versions';
import type { RewriteInstruction } from '@/lib/ai/provider';
import type { Json } from '@/lib/types/database';
import { EditorToolbar } from './editor-toolbar';
import { RewritePreviewDialog } from './rewrite-preview-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';

interface RewriteState {
  /** A qué se aplica: una selección dentro del cuerpo, o el título del artículo. */
  target: 'selection' | 'title';
  /** Solo para `target: 'selection'` — rango de ProseMirror a reemplazar al aceptar. */
  from?: number;
  to?: number;
  originalText: string;
  instruction: RewriteInstruction;
  proposedText: string | null;
  isLoading: boolean;
}

export function ArticleEditor({
  documentId,
  projectId,
  initialTitle,
  initialContentJson,
  initialVersion,
  initialWordCount,
  updatedAt,
  coverImageUrl,
  coverImageAlt,
  coverImagePrompt,
  workspaceId,
  imagesAvailable = true,
  onCoverChange,
  onContentSnapshot,
  onSaveStatusChange,
}: {
  documentId: string;
  projectId: string;
  initialTitle: string;
  initialContentJson: Json;
  initialVersion: number;
  initialWordCount: number;
  updatedAt?: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  coverImagePrompt?: string | null;
  workspaceId: string;
  /** Hay clave de OpenAI en el servidor (habilita generar/regenerar imágenes con IA). */
  imagesAvailable?: boolean;
  onCoverChange?: (cover: CoverState) => void;
  onContentSnapshot?: (snapshot: { plainText: string; html: string; json: Json; wordCount: number }) => void;
  onSaveStatusChange?: (status: AutosaveStatus) => void;
}) {
  const t = useDictionary();
  const locale = useLocale();
  const INSTRUCTION_LABELS: Record<RewriteInstruction, string> = {
    rewrite: t.editor.aiMenu.rewrite,
    shorten: t.editor.aiMenu.shorten,
    expand: t.editor.aiMenu.expand,
    simplify: t.editor.aiMenu.simplify,
    more_professional: t.editor.aiMenu.moreProfessional,
    more_conversational: t.editor.aiMenu.moreConversational,
    improve_seo: t.editor.aiMenu.improveSeo,
    convert_to_list: t.editor.aiMenu.convertToList,
    fix_grammar: t.editor.aiMenu.fixGrammar,
    regenerate: t.editor.aiMenu.regenerate,
    improve_title: t.editor.aiMenu.improveTitle,
  };
  const [title, setTitle] = useState(initialTitle);
  const [liveWordCount, setLiveWordCount] = useState(initialWordCount);
  const [rewriteState, setRewriteState] = useState<RewriteState | null>(null);
  const { status, scheduleSave, flushNow } = useAutosave(documentId, initialVersion);
  const [cover, setCover] = useState<CoverState>({
    url: coverImageUrl ?? null,
    alt: coverImageAlt ?? null,
    prompt: coverImagePrompt ?? null,
  });
  const [insertDialog, setInsertDialog] = useState<{ pos: number; text: string } | null>(null);
  const [insertUploading, setInsertUploading] = useState(false);
  const insertFileRef = useRef<HTMLInputElement>(null);
  const insertPosRef = useRef<number | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onSaveStatusChange?.(status);
  }, [status, onSaveStatusChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: t.editor.contentPlaceholder }),
      TextAlign.configure({ types: ['paragraph', 'heading'], alignments: ['left', 'center', 'right', 'justify'] }),
      BlockId,
      ArticleImage,
    ],
    content: initialContentJson as object,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const words = countWords(text);
      setLiveWordCount(words);
      const json = editor.getJSON() as Json;
      scheduleSave({ title, contentJson: json, contentHtml: editor.getHTML() });
      onContentSnapshot?.({ plainText: text, html: editor.getHTML(), json, wordCount: words });
    },
  });

  useEffect(() => {
    if (editor) {
      onContentSnapshot?.({
        plainText: editor.getText(),
        html: editor.getHTML(),
        json: editor.getJSON() as Json,
        wordCount: liveWordCount,
      });
    }
    // Solo al montar: sincroniza el estado inicial con el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Ajusta la altura del título a su contenido: además de en cada tecleo
  // (título largo que ocupa varias líneas), también cuando el textarea pasa
  // de no existir (skeleton) a existir en el DOM — si no, un título inicial
  // de más de una línea queda recortado por el overflow-hidden hasta el
  // primer cambio.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title, editor]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (editor) {
      scheduleSave({ title: value, contentJson: editor.getJSON() as Json, contentHtml: editor.getHTML() });
    }
  }

  async function handleAction(instruction: RewriteInstruction) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;

    setRewriteState({ target: 'selection', from, to, originalText: text, instruction, proposedText: null, isLoading: true });

    const result = await rewriteSectionAction({ documentId, projectId, text, instruction });

    if (!result.success) {
      toast.error(result.error.message);
      setRewriteState(null);
      return;
    }

    setRewriteState((prev) => (prev ? { ...prev, proposedText: result.data.text, isLoading: false } : prev));
  }

  async function handleImproveTitle() {
    if (!title.trim()) return;

    setRewriteState({
      target: 'title',
      originalText: title,
      instruction: 'improve_title',
      proposedText: null,
      isLoading: true,
    });

    const result = await rewriteSectionAction({ documentId, projectId, text: title, instruction: 'improve_title' });

    if (!result.success) {
      toast.error(result.error.message);
      setRewriteState(null);
      return;
    }

    setRewriteState((prev) => (prev ? { ...prev, proposedText: result.data.text, isLoading: false } : prev));
  }

  function handleAccept() {
    if (!rewriteState?.proposedText) return;

    if (rewriteState.target === 'title') {
      handleTitleChange(rewriteState.proposedText);
    } else if (editor && rewriteState.from !== undefined && rewriteState.to !== undefined) {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: rewriteState.from, to: rewriteState.to }, rewriteState.proposedText)
        .run();
    }

    void createVersionAction({
      documentId,
      reason: `${t.editor.aiMenu.heading}: ${INSTRUCTION_LABELS[rewriteState.instruction]}`,
    });

    setRewriteState(null);
  }

  function handleDiscard() {
    setRewriteState(null);
  }

  /** Tras cambiar una imagen: guarda al instante y deja una versión en el historial. */
  const commitImageChange = useCallback(
    (reason: string) => {
      void (async () => {
        await flushNow();
        await createVersionAction({ documentId, reason });
      })();
    },
    [flushNow, documentId],
  );

  const imageContext = useMemo(
    () => ({ documentId, projectId, workspaceId, imagesAvailable, commitImageChange }),
    [documentId, projectId, workspaceId, imagesAvailable, commitImageChange],
  );

  function handleCoverChange(next: CoverState) {
    setCover(next);
    onCoverChange?.(next);
  }

  /** Posición (final del bloque donde está el cursor) y texto de ese bloque, para insertar una imagen debajo. */
  function currentInsertionPoint(): { pos: number; text: string } | null {
    if (!editor) return null;
    const { $from } = editor.state.selection;
    if ($from.depth < 1) return { pos: $from.pos, text: '' };
    return { pos: $from.after(1), text: $from.node(1).textContent };
  }

  function insertImageNode(pos: number, image: { src: string; alt: string; prompt: string | null }, reason: string) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos, { type: 'image', attrs: { src: image.src, alt: image.alt, title: null, prompt: image.prompt } })
      .run();
    commitImageChange(reason);
    toast.success(t.editor.images.inserted);
  }

  function handleInsertImage(mode: 'ai' | 'upload') {
    const point = currentInsertionPoint();
    if (!point) return;
    if (mode === 'ai') {
      setInsertDialog(point);
    } else {
      insertPosRef.current = point.pos;
      insertFileRef.current?.click();
    }
  }

  async function handleInsertFile(file: File | undefined) {
    const pos = insertPosRef.current;
    if (!file || pos === null) return;
    setInsertUploading(true);
    try {
      const { url } = await uploadImageFile(file, { workspaceId, projectId });
      insertImageNode(pos, { src: url, alt: title, prompt: null }, t.editor.images.versionInserted);
    } catch (error) {
      const code = error instanceof ImageUploadError ? error.code : 'UPLOAD';
      toast.error(
        code === 'TYPE'
          ? t.editor.images.uploadTypeError
          : code === 'SIZE'
            ? t.editor.images.uploadSizeError
            : t.editor.images.uploadFailed,
      );
    } finally {
      setInsertUploading(false);
      insertPosRef.current = null;
    }
  }

  if (!editor) {
    return (
      <Card className="min-w-0 space-y-5 p-6 sm:p-10">
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }

  const readingMin = estimateReadingTimeMinutes(liveWordCount);

  return (
    <Card className="flex min-w-0 flex-col p-6 sm:p-10">
      <header>
        <EditorCover
          documentId={documentId}
          projectId={projectId}
          workspaceId={workspaceId}
          title={title}
          imagesAvailable={imagesAvailable}
          cover={cover}
          onChange={handleCoverChange}
        />

        <div className="flex items-start gap-2">
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t.editor.titlePlaceholder}
            rows={1}
            spellCheck
            className="block w-full flex-1 resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight tracking-tight text-foreground caret-primary outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleImproveTitle}
            disabled={!title.trim() || !!rewriteState}
            title={t.editor.toolbar.improveTitle}
          >
            {rewriteState?.target === 'title' && rewriteState.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Metadatos del documento */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pb-4 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {liveWordCount.toLocaleString(locale)}&nbsp;{t.common.words}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {readingMin}&nbsp;{t.common.minutesReading}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">v{initialVersion}</span>
          {updatedAt && (
            <>
              <span aria-hidden>·</span>
              <span>
                {t.editor.meta.updated} {formatUpdated(updatedAt, locale)}
              </span>
            </>
          )}
          <span className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title={t.editor.toolbar.undo}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title={t.editor.toolbar.redo}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
      </header>

      <EditorToolbar
        editor={editor}
        onAiAction={handleAction}
        onInsertImage={handleInsertImage}
        imagesAvailable={imagesAvailable}
        disabled={!!rewriteState || insertUploading}
      />

      <div className="pb-16 pt-8">
        <EditorImageProvider value={imageContext}>
          <EditorContent editor={editor} />
        </EditorImageProvider>
      </div>

      <input
        ref={insertFileRef}
        type="file"
        accept={MEDIA_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void handleInsertFile(file);
        }}
      />

      <ImageGenerateDialog
        open={!!insertDialog}
        onOpenChange={(open) => !open && setInsertDialog(null)}
        documentId={documentId}
        title={t.editor.images.insertTitle}
        description={t.editor.images.insertDescription}
        initialPrompt=""
        initialAlt=""
        suggestFromText={insertDialog?.text || title}
        imagesAvailable={imagesAvailable}
        onAccept={(choice) => {
          if (!insertDialog) return;
          insertImageNode(
            insertDialog.pos,
            { src: choice.url, alt: choice.alt || title, prompt: choice.prompt },
            t.editor.images.versionInserted,
          );
        }}
      />

      <RewritePreviewDialog
        open={!!rewriteState}
        originalText={rewriteState?.originalText ?? ''}
        proposedText={rewriteState?.proposedText ?? null}
        isLoading={!!rewriteState?.isLoading}
        onAccept={handleAccept}
        onDiscard={handleDiscard}
      />
    </Card>
  );
}

function formatUpdated(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (Number.isNaN(diffMin)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diffMin < 1) return rtf.format(0, 'minute');
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return rtf.format(-diffH, 'hour');
  return rtf.format(-Math.round(diffH / 24), 'day');
}
