import type { Editor } from '@tiptap/core';

export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

/** Bloques de texto que admiten alineación (los mismos que configura TextAlign). */
const ALIGNABLE = new Set(['paragraph', 'heading']);

/**
 * Alinea el texto: con texto seleccionado, solo los bloques de la selección;
 * sin selección (solo el cursor), TODO el texto del documento.
 */
export function alignText(editor: Editor, value: TextAlignment): boolean {
  if (!editor.state.selection.empty) {
    return editor.chain().focus().setTextAlign(value).run();
  }

  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      state.doc.descendants((node, pos) => {
        if (ALIGNABLE.has(node.type.name)) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: value });
        }
      });
      return true;
    })
    .run();
}

/**
 * Si el botón de alineación debe verse activo: con selección, el bloque donde
 * está; sin selección, cuando TODOS los bloques de texto tienen esa alineación.
 */
export function isTextAligned(editor: Editor, value: TextAlignment): boolean {
  if (!editor.state.selection.empty) return editor.isActive({ textAlign: value });

  let found = false;
  let all = true;
  editor.state.doc.descendants((node) => {
    if (!ALIGNABLE.has(node.type.name)) return;
    found = true;
    if ((node.attrs.textAlign ?? 'left') !== value) all = false;
  });
  return found && all;
}
