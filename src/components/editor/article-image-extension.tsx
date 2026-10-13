import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from './image-node-view';

/**
 * Imagen del artículo como nodo de bloque de TipTap. Además de `src`, `alt` y
 * `title` guarda `prompt`: la descripción con la que se generó, para poder
 * regenerarla editando el texto. Ese atributo vive en el JSON del documento,
 * pero NO se escribe en el HTML (ni en el embed ni en las exportaciones).
 */
export const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      prompt: { default: null, rendered: false },
      // Identifica la imagen para contar sus regeneraciones (no se escribe en el HTML).
      imageId: { default: null, rendered: false },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
}).configure({ inline: false, allowBase64: false, HTMLAttributes: { loading: 'lazy' } });
