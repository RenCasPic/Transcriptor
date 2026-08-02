'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Heading2,
  Heading3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function EditorToolbar({ editor }: { editor: Editor }) {
  function toggleLink() {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace', previousUrl ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  const buttons = [
    {
      icon: Heading2,
      label: 'Encabezado H2',
      isActive: editor.isActive('heading', { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Heading3,
      label: 'Encabezado H3',
      isActive: editor.isActive('heading', { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: Bold,
      label: 'Negrita',
      isActive: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: 'Cursiva',
      isActive: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: List,
      label: 'Lista con viñetas',
      isActive: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: 'Lista numerada',
      isActive: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: 'Cita',
      isActive: editor.isActive('blockquote'),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: LinkIcon,
      label: 'Enlace',
      isActive: editor.isActive('link'),
      onClick: toggleLink,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5">
      {buttons.map((btn) => (
        <Button
          key={btn.label}
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', btn.isActive && 'bg-accent text-accent-foreground')}
          title={btn.label}
          onClick={btn.onClick}
        >
          <btn.icon className="h-4 w-4" />
        </Button>
      ))}
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Deshacer"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Rehacer"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
