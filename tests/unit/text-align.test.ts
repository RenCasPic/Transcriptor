import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { describe, expect, it, afterEach } from 'vitest';
import { alignText, isTextAligned } from '@/lib/editor/text-align';

const HTML = '<h2>Título</h2><p>Uno</p><p>Dos</p><p>Tres</p>';

let editor: Editor;

function create() {
  editor = new Editor({
    extensions: [StarterKit, TextAlign.configure({ types: ['paragraph', 'heading'] })],
    content: HTML,
  });
  return editor;
}

function aligns(): string[] {
  const out: string[] = [];
  editor.state.doc.forEach((node) => out.push(node.attrs.textAlign));
  return out;
}

afterEach(() => editor?.destroy());

describe('alignText', () => {
  it('sin selección alinea TODO el texto', () => {
    create().commands.setTextSelection(3);
    alignText(editor, 'justify');
    expect(aligns()).toEqual(['justify', 'justify', 'justify', 'justify']);
    expect(isTextAligned(editor, 'justify')).toBe(true);
    expect(isTextAligned(editor, 'left')).toBe(false);
  });

  it('un documento sin alineación explícita cuenta como alineado a la izquierda', () => {
    create();
    expect(isTextAligned(editor, 'left')).toBe(true);
    expect(isTextAligned(editor, 'center')).toBe(false);
  });

  it('con texto seleccionado alinea solo los bloques seleccionados', () => {
    create();
    // Selecciona desde dentro de "Uno" hasta dentro de "Dos".
    const second = editor.state.doc.child(0).nodeSize + 2;
    const third = second + editor.state.doc.child(1).nodeSize;
    editor.commands.setTextSelection({ from: second, to: third + 1 });
    alignText(editor, 'center');
    expect(aligns()).toEqual([null, 'center', 'center', null]);
  });
});
