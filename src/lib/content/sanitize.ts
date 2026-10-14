import sanitizeHtml from 'sanitize-html';

/**
 * Sanitiza el HTML del artículo que llega del editor antes de guardarlo (y de
 * mostrarlo luego con `dangerouslySetInnerHTML` en /embed): lista blanca de
 * etiquetas y atributos, y solo enlaces http(s)/mailto/tel; las imágenes, solo
 * http(s). Elimina scripts, manejadores `on*`, `javascript:` y `data:`.
 *
 * Usa `sanitize-html` (JavaScript puro): `isomorphic-dompurify` arrastraba jsdom,
 * que no se puede cargar de forma fiable en las funciones de Vercel.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'a', 'br', 'img'],
    allowedAttributes: {
      '*': ['data-block-id'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    // Etiquetas no permitidas: se quita la etiqueta pero se conserva su texto
    // (excepto script/style/textarea, cuyo contenido se descarta por completo).
    disallowedTagsMode: 'discard',
  });
}
