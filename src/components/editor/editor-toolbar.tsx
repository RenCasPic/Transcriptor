'use client';

import { useEffect, useReducer } from 'react';
import type { Editor } from '@tiptap/react';
import { AlignJustify, Bold, Italic, Strikethrough, Code, Link as LinkIcon, Quote, List, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { RewriteInstruction } from '@/lib/ai/provider';

/**
 * Barra horizontal de edición de texto, siempre visible sobre el artículo.
 * Reúne el formato de bloque/marca y las acciones de IA (que operan sobre la
 * selección). Las reglas de entrada de TipTap (`## `, `- `, `**`) y los atajos
 * de teclado siguen funcionando igual.
 */
export function EditorToolbar({
  editor,
  onAiAction,
  disabled = false,
}: {
  editor: Editor;
  onAiAction: (instruction: RewriteInstruction) => void;
  disabled?: boolean;
}) {
  const t = useDictionary();
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  // La barra es estática: hay que re-renderizar cuando cambia la selección o
  // el documento para reflejar los estados activos (negrita, H2, etc.).
  useEffect(() => {
    editor.on('transaction', rerender);
    editor.on('selectionUpdate', rerender);
    return () => {
      editor.off('transaction', rerender);
      editor.off('selectionUpdate', rerender);
    };
  }, [editor]);

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

  const hasSelection = !editor.state.selection.empty;
  const btn =
    'grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40';
  const btnActive = 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground';

  return (
    <div className="sticky top-14 z-20 -mx-6 flex flex-wrap items-center gap-0.5 border-y bg-card/95 px-6 py-1.5 backdrop-blur sm:-mx-10 sm:px-10">
      <button
        type="button"
        title={t.editor.toolbar.heading2}
        disabled={disabled}
        className={cn(btn, 'w-auto px-2 text-xs font-semibold', editor.isActive('heading', { level: 2 }) && btnActive)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        title={t.editor.toolbar.heading3}
        disabled={disabled}
        className={cn(btn, 'w-auto px-2 text-xs font-semibold', editor.isActive('heading', { level: 3 }) && btnActive)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>

      <span className="mx-1 h-5 w-px bg-border" />

      <button type="button" title={t.editor.toolbar.bold} disabled={disabled} className={cn(btn, editor.isActive('bold') && btnActive)} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" title={t.editor.toolbar.italic} disabled={disabled} className={cn(btn, editor.isActive('italic') && btnActive)} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" title={t.editor.toolbar.strikethrough} disabled={disabled} className={cn(btn, editor.isActive('strike') && btnActive)} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </button>
      <button type="button" title={t.editor.toolbar.code} disabled={disabled} className={cn(btn, editor.isActive('code') && btnActive)} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" />
      </button>
      <button type="button" title={t.editor.toolbar.link} disabled={disabled} className={cn(btn, editor.isActive('link') && btnActive)} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </button>

      <span className="mx-1 h-5 w-px bg-border" />

      <button type="button" title={t.editor.toolbar.quote} disabled={disabled} className={cn(btn, editor.isActive('blockquote') && btnActive)} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </button>
      <button type="button" title={t.editor.toolbar.bulletList} disabled={disabled} className={cn(btn, editor.isActive('bulletList') && btnActive)} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t.editor.toolbar.justify}
        disabled={disabled}
        className={cn(btn, editor.isActive({ textAlign: 'justify' }) && btnActive)}
        onClick={() =>
          editor.isActive({ textAlign: 'justify' })
            ? editor.chain().focus().unsetTextAlign().run()
            : editor.chain().focus().setTextAlign('justify').run()
        }
      >
        <AlignJustify className="h-4 w-4" />
      </button>

      <span className="mx-1 h-5 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={t.editor.aiMenu.heading}
            disabled={disabled || !hasSelection}
            className={cn(btn, 'w-auto gap-1.5 px-2 text-xs font-medium')}
          >
            <Sparkles className="h-4 w-4" />
            {t.editor.aiMenu.short}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {AI_ACTIONS.map((a) => (
            <DropdownMenuItem key={a.value} onClick={() => onAiAction(a.value)}>
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
