'use client';

import { BubbleMenu, type Editor } from '@tiptap/react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RewriteInstruction } from '@/lib/ai/provider';

const ACTIONS: Array<{ value: RewriteInstruction; label: string }> = [
  { value: 'rewrite', label: 'Reescribir' },
  { value: 'shorten', label: 'Acortar' },
  { value: 'expand', label: 'Expandir' },
  { value: 'simplify', label: 'Simplificar' },
  { value: 'more_professional', label: 'Más profesional' },
  { value: 'more_conversational', label: 'Más conversacional' },
  { value: 'improve_seo', label: 'Mejorar para SEO' },
  { value: 'convert_to_list', label: 'Convertir en lista' },
  { value: 'fix_grammar', label: 'Corregir gramática' },
  { value: 'regenerate', label: 'Regenerar sección' },
];

export function AiActionMenu({
  editor,
  onAction,
}: {
  editor: Editor;
  onAction: (instruction: RewriteInstruction) => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, maxWidth: 340 }}
      shouldShow={({ state }) => !state.selection.empty}
    >
      <div className="flex max-w-xs flex-wrap gap-1 rounded-lg border bg-popover p-1.5 shadow-lg">
        <div className="flex w-full items-center gap-1 px-1 pb-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Acciones de IA
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
