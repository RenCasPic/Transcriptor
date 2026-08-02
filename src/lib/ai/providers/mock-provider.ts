import type {
  ContentGenerationProvider,
  GenerateArticleInput,
  RewriteSectionInput,
  SeoInput,
} from '@/lib/ai/provider';
import type { GeneratedArticle, SeoMetadata } from '@/lib/validations/article';
import { slugify } from '@/lib/content/slug';
import { CONTENT_TYPE_LABELS } from '@/lib/types/domain';

const HAS_NUMBER = /\b\d[\d.,%]*\b/;

function chunkSegments<T>(items: T[], chunkCount: number): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(1, Math.ceil(items.length / chunkCount));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toSentenceCase(text: string): string {
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function deriveHeading(text: string): string {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const words = firstSentence.split(/\s+/).slice(0, 8).join(' ');
  return toSentenceCase(words.replace(/[.,;:]+$/, ''));
}

/**
 * Proveedor de generación determinista, sin costo ni dependencias externas.
 * Reorganiza la transcripción real en secciones (no inventa contenido), lo
 * que lo hace apto tanto para desarrollo como para el modo demo del producto.
 */
export class MockContentGenerationProvider implements ContentGenerationProvider {
  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticle> {
    const { transcript, project } = input;
    const segments = transcript.segments;
    const sectionCount = Math.min(5, Math.max(3, Math.round(segments.length / 3)));
    const chunks = chunkSegments(segments, sectionCount);

    const title =
      project.provisionalTitle?.trim() ||
      `${CONTENT_TYPE_LABELS[project.contentType]}: ${deriveHeading(segments[0]?.text ?? 'Artículo generado')}`;

    const content: GeneratedArticle['content'] = [];
    const warnings: GeneratedArticle['warnings'] = [];

    content.push({
      id: 'intro',
      type: 'paragraph',
      text: segments[0]?.text ?? '',
      sourceSegmentIds: segments[0] ? [segments[0].id] : [],
    });

    chunks.forEach((chunk, chunkIndex) => {
      if (chunk.length === 0) return;
      const blockId = `section-${chunkIndex + 1}`;
      content.push({
        id: `${blockId}-heading`,
        type: 'heading',
        level: 2,
        text: deriveHeading(chunk[0]!.text),
        sourceSegmentIds: chunk.map((s) => s.id),
      });
      content.push({
        id: `${blockId}-body`,
        type: 'paragraph',
        text: chunk.map((s) => s.text).join(' '),
        sourceSegmentIds: chunk.map((s) => s.id),
      });

      chunk.forEach((segment) => {
        if (HAS_NUMBER.test(segment.text)) {
          warnings.push({
            blockId: `${blockId}-body`,
            type: 'number_verification',
            message: 'Esta sección contiene una cifra. Verifica que coincida exactamente con la fuente.',
          });
        }
      });
    });

    content.push({
      id: 'conclusion',
      type: 'heading',
      level: 2,
      text: 'Conclusión',
      sourceSegmentIds: [],
    });
    content.push({
      id: 'conclusion-body',
      type: 'paragraph',
      text: project.callToAction
        ? `${segments.at(-1)?.text ?? ''} ${project.callToAction}`.trim()
        : segments.at(-1)?.text ?? '',
      sourceSegmentIds: segments.at(-1) ? [segments.at(-1)!.id] : [],
    });

    const excerpt = toSentenceCase((segments[0]?.text ?? title).slice(0, 180));

    return {
      title,
      excerpt,
      content,
      faq: [
        {
          question: `¿Cuál es el objetivo principal de "${title}"?`,
          answer: project.objective ?? excerpt,
          sourceSegmentIds: [],
        },
      ],
      seo: {
        title: title.slice(0, 60),
        slug: slugify(title),
        metaDescription: excerpt.slice(0, 155),
        primaryKeyword: project.primaryKeyword ?? undefined,
        secondaryKeywords: [],
      },
      warnings,
    };
  }

  async rewriteSection(input: RewriteSectionInput): Promise<string> {
    const { text, instruction } = input;

    switch (instruction) {
      case 'shorten': {
        const sentences = text.split(/(?<=[.!?])\s+/);
        return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(' ');
      }
      case 'expand':
        return `${text} Además, vale la pena profundizar en las implicaciones prácticas de este punto para quien lo aplique.`;
      case 'simplify':
        return text
          .replace(/;/g, '.')
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(' ');
      case 'more_professional':
        return toSentenceCase(text.replace(/\s+/g, ' '));
      case 'more_conversational':
        return `${text}`.replace(/^([A-ZÁÉÍÓÚ])/, (m) => m.toLowerCase());
      case 'improve_seo':
        return input.primaryKeyword && !text.toLowerCase().includes(input.primaryKeyword.toLowerCase())
          ? `${text} ${toSentenceCase(input.primaryKeyword)} es un aspecto clave de este punto.`
          : text;
      case 'convert_to_list':
        return text
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .map((s) => `- ${s.trim()}`)
          .join('\n');
      case 'fix_grammar':
        return text
          .split(/(?<=[.!?])\s+/)
          .map((s) => toSentenceCase(s.trim()))
          .join(' ');
      case 'regenerate':
        return toSentenceCase(text.split(/\s+/).reverse().join(' ').split(/\s+/).reverse().join(' '));
      case 'rewrite':
      default:
        return toSentenceCase(text.trim());
    }
  }

  async generateSeoMetadata(input: SeoInput): Promise<SeoMetadata> {
    return {
      title: input.title.slice(0, 60),
      slug: slugify(input.title),
      metaDescription: input.excerpt.slice(0, 155),
      primaryKeyword: input.primaryKeyword ?? undefined,
      secondaryKeywords: [],
    };
  }
}
