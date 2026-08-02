import type { ArticleNode, FaqItem } from '@/lib/validations/article';
import type { Json } from '@/lib/types/database';

/**
 * Convierte los bloques estructurados devueltos por el proveedor de IA en un
 * documento ProseMirror (el formato que consume TipTap). Cada bloque
 * compatible conserva su `blockId` como atributo para poder:
 *  - resaltarlo al usar "Ver fuente" (content_source_links).
 *  - vincularlo con alertas (content_warnings).
 * La extensión `BlockId` (src/lib/editor/block-id-extension.ts) declara este
 * atributo a nivel de esquema para que TipTap lo reconozca y lo preserve.
 */
export function articleNodesToProseMirrorJson(nodes: ArticleNode[], faq: FaqItem[]): Json {
  const content: Json[] = [];

  nodes.forEach((node) => {
    if (node.type === 'heading') {
      content.push({
        type: 'heading',
        attrs: { level: node.level ?? 2, blockId: node.id },
        content: node.text ? [{ type: 'text', text: node.text }] : [],
      });
      return;
    }

    if (node.type === 'quote') {
      content.push({
        type: 'blockquote',
        attrs: { blockId: node.id },
        content: [
          {
            type: 'paragraph',
            content: node.text ? [{ type: 'text', text: node.text }] : [],
          },
        ],
      });
      return;
    }

    if (node.type === 'list') {
      content.push({
        type: node.ordered ? 'orderedList' : 'bulletList',
        attrs: { blockId: node.id },
        content: (node.items ?? []).map((item) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: item ? [{ type: 'text', text: item }] : [] }],
        })),
      });
      return;
    }

    content.push({
      type: 'paragraph',
      attrs: { blockId: node.id },
      content: node.text ? [{ type: 'text', text: node.text }] : [],
    });
  });

  if (faq.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 2, blockId: 'faq-heading' },
      content: [{ type: 'text', text: 'Preguntas frecuentes' }],
    });

    faq.forEach((item, i) => {
      content.push({
        type: 'heading',
        attrs: { level: 3, blockId: `faq-${i}-question` },
        content: [{ type: 'text', text: item.question }],
      });
      content.push({
        type: 'paragraph',
        attrs: { blockId: `faq-${i}-answer` },
        content: [{ type: 'text', text: item.answer }],
      });
    });
  }

  return { type: 'doc', content } as Json;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Renderiza el documento ProseMirror generado por `articleNodesToProseMirrorJson` a HTML. */
export function proseMirrorJsonToHtml(doc: Json): string {
  const docObj = doc as { content?: Array<Record<string, unknown>> };
  const blocks = docObj.content ?? [];

  function renderInline(content: Array<{ text?: string }> | undefined): string {
    return (content ?? []).map((n) => escapeHtml(n.text ?? '')).join('');
  }

  return blocks
    .map((block) => {
      const attrs = (block.attrs as { blockId?: string; level?: number } | undefined) ?? {};
      const blockIdAttr = attrs.blockId ? ` data-block-id="${attrs.blockId}"` : '';
      const content = block.content as Array<Record<string, unknown>> | undefined;

      switch (block.type) {
        case 'heading': {
          const level = attrs.level ?? 2;
          return `<h${level}${blockIdAttr}>${renderInline(content as never)}</h${level}>`;
        }
        case 'blockquote': {
          const inner = (content ?? [])
            .map((p) => `<p>${renderInline((p.content as never) ?? [])}</p>`)
            .join('');
          return `<blockquote${blockIdAttr}>${inner}</blockquote>`;
        }
        case 'bulletList':
        case 'orderedList': {
          const tag = block.type === 'bulletList' ? 'ul' : 'ol';
          const items = (content ?? [])
            .map((li) => {
              const liContent = li.content as Array<Record<string, unknown>> | undefined;
              const paragraph = liContent?.[0];
              return `<li>${renderInline((paragraph?.content as never) ?? [])}</li>`;
            })
            .join('');
          return `<${tag}${blockIdAttr}>${items}</${tag}>`;
        }
        case 'paragraph':
        default:
          return `<p${blockIdAttr}>${renderInline(content as never)}</p>`;
      }
    })
    .join('\n');
}

/** Convierte el documento ProseMirror a Markdown plano (para exportación). */
export function proseMirrorJsonToMarkdown(doc: Json): string {
  const docObj = doc as { content?: Array<Record<string, unknown>> };
  const blocks = docObj.content ?? [];

  function renderInline(content: Array<{ text?: string }> | undefined): string {
    return (content ?? []).map((n) => n.text ?? '').join('');
  }

  return blocks
    .map((block) => {
      const attrs = (block.attrs as { level?: number } | undefined) ?? {};
      const content = block.content as Array<Record<string, unknown>> | undefined;

      switch (block.type) {
        case 'heading': {
          const level = attrs.level ?? 2;
          return `${'#'.repeat(level)} ${renderInline(content as never)}`;
        }
        case 'blockquote':
          return (content ?? [])
            .map((p) => `> ${renderInline((p.content as never) ?? [])}`)
            .join('\n');
        case 'bulletList':
          return (content ?? [])
            .map((li) => {
              const liContent = li.content as Array<Record<string, unknown>> | undefined;
              return `- ${renderInline((liContent?.[0]?.content as never) ?? [])}`;
            })
            .join('\n');
        case 'orderedList':
          return (content ?? [])
            .map((li, i) => {
              const liContent = li.content as Array<Record<string, unknown>> | undefined;
              return `${i + 1}. ${renderInline((liContent?.[0]?.content as never) ?? [])}`;
            })
            .join('\n');
        case 'paragraph':
        default:
          return renderInline(content as never);
      }
    })
    .join('\n\n');
}

/** Extrae texto plano del documento (para conteo de palabras, SEO, detección de alertas). */
export function proseMirrorJsonToPlainText(doc: Json): string {
  const docObj = doc as { content?: Array<Record<string, unknown>> };
  const blocks = docObj.content ?? [];

  function extract(node: Record<string, unknown>): string {
    if (node.type === 'text') return (node.text as string) ?? '';
    const content = node.content as Array<Record<string, unknown>> | undefined;
    return (content ?? []).map(extract).join(' ');
  }

  return blocks.map(extract).join('\n\n').trim();
}
