'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Heading2,
  Heading3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

interface ToolbarButton {
  icon: typeof Bold;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const t = useDictionary();

  function toggleLink() {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t.editor.toolbar.linkPrompt, previousUrl ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  const groups: ToolbarButton[][] = [
    [
      {
        icon: Heading2,
        label: t.editor.toolbar.heading2,
        isActive: editor.isActive('heading', { level: 2 }),
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        icon: Heading3,
        label: t.editor.toolbar.heading3,
        isActive: editor.isActive('heading', { level: 3 }),
        onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        icon: Bold,
        label: t.editor.toolbar.bold,
        isActive: editor.isActive('bold'),
        onClick: () => editor.chain().focus().toggleBold().run(),
      },
      {
        icon: Italic,
        label: t.editor.toolbar.italic,
        isActive: editor.isActive('italic'),
        onClick: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        icon: Strikethrough,
        label: t.editor.toolbar.strikethrough,
        isActive: editor.isActive('strike'),
        onClick: () => editor.chain().focus().toggleStrike().run(),
      },
      {
        icon: Code,
        label: t.editor.toolbar.code,
        isActive: editor.isActive('code'),
        onClick: () => editor.chain().focus().toggleCode().run(),
      },
      {
        icon: LinkIcon,
        label: t.editor.toolbar.link,
        isActive: editor.isActive('link'),
        onClick: toggleLink,
      },
    ],
    [
      {
        icon: List,
        label: t.editor.toolbar.bulletList,
        isActive: editor.isActive('bulletList'),
        onClick: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        icon: ListOrdered,
        label: t.editor.toolbar.orderedList,
        isActive: editor.isActive('orderedList'),
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        icon: Quote,
        label: t.editor.toolbar.quote,
        isActive: editor.isActive('blockquote'),
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        icon: Minus,
        label: t.editor.toolbar.horizontalRule,
        onClick: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
    [
      {
        icon: Undo2,
        label: t.editor.toolbar.undo,
        disabled: !editor.can().undo(),
        onClick: () => editor.chain().focus().undo().run(),
      },
      {
        icon: Redo2,
        label: t.editor.toolbar.redo,
        disabled: !editor.can().redo(),
        onClick: () => editor.chain().focus().redo().run(),
      },
    ],
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-y border-border bg-background/95 px-3 py-2 backdrop-blur">
      {groups.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />}
          {group.map((btn) => (
            <Button
              key={btn.label}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 rounded-md text-muted-foreground hover:text-foreground',
                btn.isActive && 'bg-primary/10 text-primary hover:text-primary',
              )}
              title={btn.label}
              disabled={btn.disabled}
              onClick={btn.onClick}
            >
              <btn.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
