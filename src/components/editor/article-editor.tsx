'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import { BlockId } from '@/lib/editor/block-id-extension';
import { useAutosave, type AutosaveStatus } from '@/lib/editor/use-autosave';
import { countWords, estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { rewriteSectionAction } from '@/lib/actions/editor';
import { createVersionAction } from '@/lib/actions/versions';
import type { RewriteInstruction } from '@/lib/ai/provider';
import type { Json } from '@/lib/types/database';
import { EditorContextMenu } from './editor-context-menu';
import { RewritePreviewDialog } from './rewrite-preview-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';

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
  updatedAt,
  coverImageUrl,
  coverImageAlt,
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
  };
  const [title, setTitle] = useState(initialTitle);
  const [liveWordCount, setLiveWordCount] = useState(initialWordCount);
  const [rewriteState, setRewriteState] = useState<RewriteState | null>(null);
  const { status, scheduleSave } = useAutosave(documentId, initialVersion);

  useEffect(() => {
    onSaveStatusChange?.(status);
  }, [status, onSaveStatusChange]);

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
    // Solo al montar: sincroniza el estado inicial con el panel.
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
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={coverImageAlt ?? ''}
            className="mb-8 aspect-[16/6] w-full rounded-lg border object-cover"
          />
        )}

        <textarea
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t.editor.titlePlaceholder}
          rows={1}
          spellCheck
          className="block w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight tracking-tight text-foreground caret-primary outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
        />

        {/* Metadatos del documento */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b pb-4 text-xs text-muted-foreground">
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

      <div className="pb-16 pt-6">
        <EditorContextMenu editor={editor} onAiAction={handleAction} disabled={!!rewriteState} />
        <EditorContent editor={editor} />
      </div>

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
