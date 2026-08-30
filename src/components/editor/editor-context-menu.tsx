'use client';

import { useState } from 'react';
import { BubbleMenu, type Editor } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon, Quote, List, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { RewriteInstruction } from '@/lib/ai/provider';

/**
 * Las herramientas del editor viven aquí y SOLO aparecen sobre la selección.
 * No hay barra permanente: escribir `## `, `- `, `> `, `**` etc. ya aplica el
 * formato (reglas de entrada de TipTap), y los atajos de teclado siguen
 * funcionando. Este menú contextual reúne el formato fino y las acciones de IA.
 */
export function EditorContextMenu({
  editor,
  onAiAction,
  disabled = false,
}: {
  editor: Editor;
  onAiAction: (instruction: RewriteInstruction) => void;
  disabled?: boolean;
}) {
  const t = useDictionary();
  const [aiOpen, setAiOpen] = useState(false);

  function setLink() {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t.editor.toolbar.linkPrompt, previous ?? 'https://');
    if (url === null) return;
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  const AI_ACTIONS: Array<{ value: RewriteInstruction; label: string }> = [
    { value: 'rewrite', label: t.editor.aiMenu.rewrite },
    { value: 'shorten', label: t.editor.aiMenu.shorten },
    { value: 'expand', label: t.editor.aiMenu.expand },
    { value: 'simplify', label: t.editor.aiMenu.simplify },
    { value: 'more_professional', label: t.editor.aiMenu.moreProfessional },
    { value: 'more_conversational', label: t.editor.aiMenu.moreConversational },
    { value: 'improve_seo', label: t.editor.aiMenu.improveSeo },
    { value: 'convert_to_list', label: t.editor.aiMenu.convertToList },
    { value: 'fix_grammar', label: t.editor.aiMenu.fixGrammar },
    { value: 'regenerate', label: t.editor.aiMenu.regenerate },
  ];

  const tool =
    'grid h-7 w-7 place-items-center text-[hsl(var(--ed-ink-soft))] transition-colors hover:bg-[hsl(var(--ed-paper-sunk))] hover:text-[hsl(var(--ed-ink))]';
  const toolActive = 'bg-[hsl(var(--ed-ink))] text-[hsl(var(--ed-paper))] hover:bg-[hsl(var(--ed-ink))] hover:text-[hsl(var(--ed-paper))]';

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 120, maxWidth: 400, zIndex: 40, onHidden: () => setAiOpen(false) }}
      shouldShow={({ state }) => !disabled && !state.selection.empty}
    >
      <div className="flex flex-col border border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] font-sans shadow-[3px_3px_0_hsl(var(--ed-rule))]">
        <div className="flex items-stretch">
          <button type="button" title={t.editor.toolbar.heading2} className={cn(tool, 'w-auto px-2 font-mono text-xs', editor.isActive('heading', { level: 2 }) && toolActive)} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button type="button" title={t.editor.toolbar.heading3} className={cn(tool, 'w-auto px-2 font-mono text-xs', editor.isActive('heading', { level: 3 }) && toolActive)} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            H3
          </button>
          <span className="my-1.5 w-px bg-[hsl(var(--ed-rule))]" />
          <button type="button" title={t.editor.toolbar.bold} className={cn(tool, editor.isActive('bold') && toolActive)} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button type="button" title={t.editor.toolbar.italic} className={cn(tool, editor.isActive('italic') && toolActive)} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button type="button" title={t.editor.toolbar.strikethrough} className={cn(tool, editor.isActive('strike') && toolActive)} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button type="button" title={t.editor.toolbar.code} className={cn(tool, editor.isActive('code') && toolActive)} onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code className="h-3.5 w-3.5" />
          </button>
          <button type="button" title={t.editor.toolbar.link} className={cn(tool, editor.isActive('link') && toolActive)} onClick={setLink}>
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <span className="my-1.5 w-px bg-[hsl(var(--ed-rule))]" />
          <button type="button" title={t.editor.toolbar.quote} className={cn(tool, editor.isActive('blockquote') && toolActive)} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-3.5 w-3.5" />
          </button>
          <button type="button" title={t.editor.toolbar.bulletList} className={cn(tool, editor.isActive('bulletList') && toolActive)} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-3.5 w-3.5" />
          </button>
          <span className="my-1.5 w-px bg-[hsl(var(--ed-rule))]" />
          <button
            type="button"
            className={cn(tool, 'w-auto gap-1.5 px-2 font-mono text-[0.68rem] uppercase tracking-[0.12em]', aiOpen && toolActive)}
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.editor.aiMenu.short}
          </button>
        </div>

        {aiOpen && (
          <div className="grid grid-cols-2 gap-px border-t border-[hsl(var(--ed-rule))] bg-[hsl(var(--ed-rule))]">
            {AI_ACTIONS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => {
                  onAiAction(a.value);
                  setAiOpen(false);
                }}
                className="bg-[hsl(var(--ed-paper))] px-2.5 py-1.5 text-left font-mono text-[0.68rem] uppercase tracking-[0.06em] text-[hsl(var(--ed-ink-soft))] transition-colors hover:bg-[hsl(var(--ed-paper-sunk))] hover:text-[hsl(var(--ed-ink))]"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
