'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { toast } from 'sonner';
import { BlockId } from '@/lib/editor/block-id-extension';
import { useAutosave } from '@/lib/editor/use-autosave';
import { countWords } from '@/lib/content/metrics';
import { rewriteSectionAction } from '@/lib/actions/editor';
import { createVersionAction } from '@/lib/actions/versions';
import type { RewriteInstruction } from '@/lib/ai/provider';
import type { Json } from '@/lib/types/database';
import { EditorToolbar } from './editor-toolbar';
import { AiActionMenu } from './ai-action-menu';
import { RewritePreviewDialog } from './rewrite-preview-dialog';
import { EditorFooter } from './editor-footer';
import { Skeleton } from '@/components/ui/skeleton';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

interface RewriteState {
  from: number;
  to: number;
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
  coverImageUrl,
  coverImageAlt,
  onContentSnapshot,
}: {
  documentId: string;
  projectId: string;
  initialTitle: string;
  initialContentJson: Json;
  initialVersion: number;
  initialWordCount: number;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  onContentSnapshot?: (snapshot: { plainText: string; html: string; json: Json; wordCount: number }) => void;
}) {
  const t = useDictionary();
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
  };
  const [title, setTitle] = useState(initialTitle);
  const [liveWordCount, setLiveWordCount] = useState(initialWordCount);
  const [rewriteState, setRewriteState] = useState<RewriteState | null>(null);
  const { status, scheduleSave } = useAutosave(documentId, initialVersion);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: t.editor.contentPlaceholder }),
      BlockId,
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
    // Solo al montar: sincroniza el estado inicial con el panel SEO.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

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

    setRewriteState({ from, to, originalText: text, instruction, proposedText: null, isLoading: true });

    const result = await rewriteSectionAction({ documentId, projectId, text, instruction });

    if (!result.success) {
      toast.error(result.error.message);
      setRewriteState(null);
      return;
    }

    setRewriteState((prev) => (prev ? { ...prev, proposedText: result.data.text, isLoading: false } : prev));
  }

  function handleAccept() {
    if (!editor || !rewriteState?.proposedText) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: rewriteState.from, to: rewriteState.to }, rewriteState.proposedText)
      .run();

    void createVersionAction({
      documentId,
      reason: `${t.editor.aiMenu.heading}: ${INSTRUCTION_LABELS[rewriteState.instruction]}`,
    });

    setRewriteState(null);
  }

  function handleDiscard() {
    setRewriteState(null);
  }

  if (!editor) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  return (
    // min-h-0 es la pieza clave: sin esto, este contenedor (item flex dentro
    // de la columna del EditorShell) se estiraría al alto natural de su
    // contenido en vez de respetar el alto que le da el layout padre, y el
    // scroll interno de más abajo dejaría de funcionar correctamente.
    <div className="flex h-full min-h-0 flex-col">
      {/* Header: fuera del contenedor con scroll → siempre visible, sin necesitar position:sticky. */}
      <div className="shrink-0 border-b bg-gradient-to-b from-primary/5 to-background px-4 py-2.5 sm:px-8">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t.editor.titlePlaceholder}
          className="mx-auto block w-full max-w-3xl bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Toolbar: también fuera del scroll → siempre visible. */}
      <EditorToolbar editor={editor} />

      {/* Único contenedor con scroll de este panel. flex-1 + min-h-0 le dan
          exactamente el espacio restante (≈85-90% del panel); el padding
          inferior generoso deja lugar para hacer clic después del último
          párrafo y mantiene el último bloque siempre visible al final. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 pb-32 sm:px-8">
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt={coverImageAlt ?? ''}
              className="mb-6 aspect-[16/6] w-full rounded-lg object-cover shadow-sm"
            />
          )}
          <AiActionMenu editor={editor} onAction={handleAction} />
          <EditorContent editor={editor} />
        </div>
      </div>

      <EditorFooter wordCount={liveWordCount} status={status} />

      <RewritePreviewDialog
        open={!!rewriteState}
        originalText={rewriteState?.originalText ?? ''}
        proposedText={rewriteState?.proposedText ?? null}
        isLoading={!!rewriteState?.isLoading}
        onAccept={handleAccept}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
