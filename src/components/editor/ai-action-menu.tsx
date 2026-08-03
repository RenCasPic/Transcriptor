'use client';

import { BubbleMenu, type Editor } from '@tiptap/react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { RewriteInstruction } from '@/lib/ai/provider';

export function AiActionMenu({
  editor,
  onAction,
}: {
  editor: Editor;
  onAction: (instruction: RewriteInstruction) => void;
}) {
  const t = useDictionary();
  const ACTIONS: Array<{ value: RewriteInstruction; label: string }> = [
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

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, maxWidth: 340 }}
      shouldShow={({ state }) => !state.selection.empty}
    >
      <div className="flex max-w-xs flex-wrap gap-1 rounded-lg border bg-popover p-1.5 shadow-lg">
        <div className="flex w-full items-center gap-1 px-1 pb-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          {t.editor.aiMenu.heading}
        </div>
        {ACTIONS.map((action) => (
          <Button
            key={action.value}
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onAction(action.value)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </BubbleMenu>
  );
}
