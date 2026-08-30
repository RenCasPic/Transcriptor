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
import { SaveStatusIndicator } from './save-status-indicator';
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
  contentTypeLabel,
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
  contentTypeLabel?: string;
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
      <div className="space-y-5 px-8 py-20 pl-16">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  const readingMin = estimateReadingTimeMinutes(liveWordCount);

  return (
    // Márgenes editoriales asimétricos: mucho aire a la izquierda (donde vuelan
    // las coordenadas §), la mancha de texto desplazada.
    <div className="flex flex-col pl-6 pr-6 sm:pl-16 sm:pr-10">
      <header className="pt-16">
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt={coverImageAlt ?? ''}
            className="mb-10 aspect-[16/6] w-full object-cover grayscale-[0.2]"
          />
        )}

        <p className="ed-label mb-6 text-[hsl(var(--ed-ink-faint))]">
          {contentTypeLabel ?? t.editor.masthead.kicker}
          <span className="mx-2 text-[hsl(var(--ed-rule-strong))]">·</span>§00
        </p>

        <textarea
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t.editor.titlePlaceholder}
          rows={1}
          spellCheck
          className="block w-full resize-none overflow-hidden bg-transparent font-display text-[2.6rem] font-medium leading-[1.03] tracking-[-0.02em] text-[hsl(var(--ed-ink))] caret-[hsl(var(--ed-accent))] outline-none placeholder:text-[hsl(var(--ed-ink-faint))] sm:text-[3.7rem]"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
        />

        {/* Datos de registro del manuscrito. */}
        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-[hsl(var(--ed-rule))] py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-[hsl(var(--ed-ink-faint))]">
          <span className="tabular-nums text-[hsl(var(--ed-ink-soft))]">
            {liveWordCount.toLocaleString(locale)}&nbsp;{t.common.words}
          </span>
          <Rule />
          <span className="tabular-nums text-[hsl(var(--ed-ink-soft))]">
            {readingMin}&nbsp;{t.common.minutesReading}
          </span>
          <Rule />
          <span className="tabular-nums">v{initialVersion}</span>
          <Rule />
          <SaveStatusIndicator status={status} />
          {updatedAt && (
            <>
              <Rule />
              <span className="normal-case tracking-normal">
                {t.editor.meta.updated} {formatUpdated(updatedAt, locale)}
              </span>
            </>
          )}
          <span className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title={t.editor.toolbar.undo}
              className="grid h-6 w-6 place-items-center text-[hsl(var(--ed-ink-faint))] transition-colors hover:text-[hsl(var(--ed-ink))] disabled:opacity-25"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title={t.editor.toolbar.redo}
              className="grid h-6 w-6 place-items-center text-[hsl(var(--ed-ink-faint))] transition-colors hover:text-[hsl(var(--ed-ink))] disabled:opacity-25"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </header>

      <div className="pb-40 pt-14">
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
    </div>
  );
}

function Rule() {
  return <span aria-hidden className="h-2.5 w-px bg-[hsl(var(--ed-rule-strong))]" />;
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
