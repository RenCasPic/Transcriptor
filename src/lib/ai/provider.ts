import type { GeneratedArticle, SeoMetadata } from '@/lib/validations/article';
import type { ArticleTone, ContentType } from '@/lib/types/database';

export interface TranscriptSegmentInput {
  id: string;
  index: number;
  speaker: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  text: string;
}

export interface GenerateArticleInput {
  transcript: {
    fullText: string;
    segments: TranscriptSegmentInput[];
    language: string;
  };
  project: {
    contentType: ContentType;
    audience: string | null;
    tone: ArticleTone;
    language: string;
    primaryKeyword: string | null;
    objective: string | null;
    callToAction: string | null;
    provisionalTitle: string | null;
  };
}

export type RewriteInstruction =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'simplify'
  | 'more_professional'
  | 'more_conversational'
  | 'improve_seo'
  | 'convert_to_list'
  | 'fix_grammar'
  | 'regenerate';

export interface RewriteSectionInput {
  text: string;
  instruction: RewriteInstruction;
  tone: ArticleTone;
  language: string;
  audience: string | null;
  primaryKeyword: string | null;
}

export interface SeoInput {
  title: string;
  excerpt: string;
  contentPlainText: string;
  primaryKeyword: string | null;
  language: string;
}

/** Abstracción sobre cualquier proveedor de generación de contenido con IA. */
export interface ContentGenerationProvider {
  generateArticle(input: GenerateArticleInput): Promise<GeneratedArticle>;
  rewriteSection(input: RewriteSectionInput): Promise<string>;
  generateSeoMetadata(input: SeoInput): Promise<SeoMetadata>;
}

export interface TranscriptionInput {
  /** URL firmada del archivo de audio/video a transcribir. */
  mediaUrl?: string;
  /** Si es verdadero, se devuelve la transcripción de demostración sin llamar a ningún servicio externo. */
  demo?: boolean;
  language: string;
}

export interface TranscriptResultSegment {
  index: number;
  speaker: string | null;
  startSeconds: number;
  endSeconds: number;
  text: string;
  confidence: number | null;
}

export interface TranscriptResult {
  fullText: string;
  segments: TranscriptResultSegment[];
}

/** Abstracción sobre cualquier proveedor de transcripción de audio/video. */
export interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptResult>;
}
