import { Extension } from '@tiptap/react';

/**
 * Declara el atributo `blockId` en los tipos de bloque relevantes para poder
 * relacionar cada sección del artículo con segmentos fuente (content_source_links)
 * y con alertas de fidelidad (content_warnings). Se renderiza como `data-block-id`
 * para que el panel de fuentes pueda hacer scroll/resaltado por selector CSS.
 */
export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList'],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-id'),
            renderHTML: (attributes) => {
              if (!attributes.blockId) return {};
              return { 'data-block-id': attributes.blockId };
            },
          },
        },
      },
    ];
  },
});
