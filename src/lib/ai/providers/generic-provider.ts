import type {
  ContentGenerationProvider,
  GenerateArticleInput,
  RewriteSectionInput,
  SeoInput,
} from '@/lib/ai/provider';
import {
  GeneratedArticleSchema,
  SeoMetadataSchema,
  ExtractionResultSchema,
  ArticleOutlineSchema,
  SectionResultSchema,
  ArticleMetaSchema,
  type ExtractedNote,
  type ArticleOutline,
  type GeneratedArticle,
  type SeoMetadata,
} from '@/lib/validations/article';
import {
  buildArticlePrompt,
  buildOutlinePrompt,
  buildSectionPrompt,
  buildArticleMetaPrompt,
} from '@/lib/prompts/article';
import { buildExtractionPrompt } from '@/lib/prompts/extraction';
import { buildRewritePrompt } from '@/lib/prompts/rewrite';
import { buildSeoPrompt } from '@/lib/prompts/seo';
import type { z } from 'zod';

type ArticleMeta = z.infer<typeof ArticleMetaSchema>;

const JSON_SYSTEM_PROMPT =
  'Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código markdown.';

// Tope de tokens de SALIDA del artículo. Generoso a propósito: el prompt pide
// un artículo completo y proporcional al contenido de la transcripción, así que
// una conversación rica de 30-60 min puede producir 3000-6000 palabras
// (~5000-9000 tokens). El modelo termina solo cuando ha cubierto el material;
// este tope solo evita una respuesta desbocada. gpt-4o-mini admite hasta 16384.
const ARTICLE_MAX_OUTPUT_TOKENS = Number(process.env.AI_ARTICLE_MAX_TOKENS ?? 12000);

// Generación en dos etapas: por debajo de este número de segmentos, un solo
// modelo redacta el artículo directamente de la transcripción (funciona bien
// para audios cortos). Por encima, gpt-4o-mini deja de aprovechar la parte
// central/final de una transcripción larga aunque le quepa en contexto, así
// que se hace: (1) extraer notas por bloques -> (2) redactar desde las notas.
const SINGLE_PASS_MAX_SEGMENTS = Number(process.env.AI_SINGLE_PASS_MAX_SEGMENTS ?? 70);
const EXTRACT_BLOCK_SEGMENTS = Number(process.env.AI_EXTRACT_BLOCK_SEGMENTS ?? 45);
const EXTRACT_MAX_OUTPUT_TOKENS = 4000;
const EXTRACT_CONCURRENCY = Number(process.env.AI_EXTRACT_CONCURRENCY ?? 4);
const SECTION_CONCURRENCY = Number(process.env.AI_SECTION_CONCURRENCY ?? 4);

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Tope de tokens de ENTRADA (prompt + transcripción) para la generación del
// artículo. Por defecto 110k: cabe de sobra en el contexto de gpt-4o-mini
// (128k) incluso para una transcripción de varias horas, dejando margen para la
// respuesta. Solo se supera con transcripciones excepcionalmente largas (más
// que el propio MEDIA_MAX_DURATION_SECONDS por defecto). Estimación por
// caracteres (~4 por token) para no depender de un tokenizador.
const MAX_PROMPT_TOKENS = Number(process.env.AI_MAX_PROMPT_TOKENS ?? 110_000);
const CHARS_PER_TOKEN = 4;

const MAX_RETRY_WAIT_MS = 20_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);
const QUOTA_BODY_HINT = /insufficient_quota|exceeded your current quota|credit balance is too low/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST con reintento ante errores transitorios: 429 (rate limit) y 5xx. NO
 * reintenta:
 *  - 401/403/404/413 ni 400: no se arreglan esperando.
 *  - 429 cuando el cuerpo indica falta de saldo (`insufficient_quota`): OpenAI
 *    usa 429 tanto para rate limit como para cuota agotada; solo lo segundo NO
 *    debe reintentarse.
 * Respeta `retry-after` (o el "try again in Xs" del cuerpo) para el tiempo de
 * espera, con un tope.
 */
async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (networkError) {
      if (attempt >= MAX_RETRIES) throw networkError;
      await sleep(2000);
      continue;
    }

    if (!RETRYABLE_STATUS.has(response.status) || attempt >= MAX_RETRIES) return response;

    const body = await response.clone().text().catch(() => '');
    if (response.status === 429 && QUOTA_BODY_HINT.test(body)) return response;

    const headerWait = Number(response.headers.get('retry-after')) * 1000;
    const bodyWait = Number(/try again in ([\d.]+)s/i.exec(body)?.[1]) * 1000;
    const hinted = Number.isFinite(headerWait) && headerWait > 0 ? headerWait : bodyWait;
    const wait = Math.min(MAX_RETRY_WAIT_MS, Math.max(250, Number.isFinite(hinted) && hinted > 0 ? hinted : 2000));
    await sleep(wait);
  }
}

interface ModelCallParams {
  system: string;
  prompt: string;
  maxTokens: number;
  /** Fuerza el modo JSON estricto del proveedor (evita texto extra o bloques markdown envolviendo la respuesta). */
  jsonMode?: boolean;
}

interface ModelCaller {
  call(params: ModelCallParams): Promise<string>;
}

class AnthropicCaller implements ModelCaller {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async call({ system, prompt, maxTokens }: ModelCallParams): Promise<string> {
    const response = await postWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`AI_PROVIDER_HTTP_ERROR:${response.status}:${errorBody.slice(0, 300)}`);
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((block) => block.type === 'text')?.text;
    if (!text) throw new Error('AI_PROVIDER_EMPTY_RESPONSE');
    return text;
  }
}

class OpenAiCaller implements ModelCaller {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async call({ system, prompt, maxTokens, jsonMode }: ModelCallParams): Promise<string> {
    const response = await postWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`AI_PROVIDER_HTTP_ERROR:${response.status}:${errorBody.slice(0, 300)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI_PROVIDER_EMPTY_RESPONSE');
    return text;
  }
}

/**
 * Igual que OpenAiCaller (mismo formato de API), pero contra Groq: modelos
 * open-weight (Llama, etc.) servidos gratis dentro de un límite de uso
 * razonable, sin tarjeta de crédito. Pensado como alternativa sin costo a
 * Anthropic/OpenAI mientras no se contrate un proveedor de pago.
 */
class GroqCaller implements ModelCaller {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async call({ system, prompt, maxTokens, jsonMode }: ModelCallParams): Promise<string> {
    const response = await postWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        // Los sistemas "groq/compound*" pueden usar herramientas (búsqueda web,
        // ejecución de código) por su cuenta. Para la generación de artículos
        // eso rompería la fidelidad a la fuente, así que se deshabilitan: se usa
        // solo como un LLM normal (con más límite de tokens/minuto que el resto
        // de modelos del plan gratuito de Groq).
        ...(this.model.startsWith('groq/compound')
          ? { compound_custom: { tools: { enabled_tools: [] } } }
          : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`AI_PROVIDER_HTTP_ERROR:${response.status}:${errorBody.slice(0, 300)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('AI_PROVIDER_EMPTY_RESPONSE');
    return text;
  }
}

/**
 * En el prompt los segmentos se etiquetan como "s0", "s1", ... (índice) en vez
 * de con su UUID real, para no gastar ~15 tokens por segmento en la petición
 * (una transcripción de 30 min tiene cientos de segmentos). Aquí se traduce
 * cada etiqueta de vuelta al UUID del segmento antes de devolver el artículo,
 * de modo que el pipeline (`content_source_links`) sigue funcionando igual.
 */
function remapSegmentRefs(article: GeneratedArticle, input: GenerateArticleInput): GeneratedArticle {
  const byIndex = new Map<number, string>();
  for (const seg of input.transcript.segments) byIndex.set(seg.index, seg.id);
  const validIds = new Set(input.transcript.segments.map((s) => s.id));

  const resolve = (ref: string): string | null => {
    if (validIds.has(ref)) return ref; // el modelo devolvió el UUID directamente
    const match = /^s?(\d+)$/i.exec(ref.trim());
    if (!match) return null;
    return byIndex.get(Number(match[1])) ?? null;
  };

  const mapRefs = (refs: string[]): string[] =>
    Array.from(new Set(refs.map(resolve).filter((id): id is string => id !== null)));

  return {
    ...article,
    content: article.content.map((node) => ({ ...node, sourceSegmentIds: mapRefs(node.sourceSegmentIds) })),
    faq: article.faq.map((item) => ({ ...item, sourceSegmentIds: mapRefs(item.sourceSegmentIds) })),
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonText = fenced ? fenced[1]! : trimmed;
  return JSON.parse(jsonText);
}

const ARTICLE_JSON_SHAPE = `Devuelve un JSON con exactamente esta forma:
{
  "title": string,
  "excerpt": string,
  "content": [{ "id": string, "type": "heading"|"paragraph"|"list"|"quote", "level"?: 2|3, "ordered"?: boolean, "items"?: string[], "text"?: string, "sourceSegmentIds": string[] }],
  "faq": [{ "question": string, "answer": string, "sourceSegmentIds": string[] }],
  "seo": { "title": string, "slug": string, "metaDescription": string, "primaryKeyword"?: string, "secondaryKeywords": string[] },
  "warnings": [{ "blockId": string|null, "type": "unsupported_claim"|"number_verification"|"name_verification"|"date_verification"|"possible_hallucination"|"missing_source", "message": string }]
}`;

function parseArticle(raw: string): GeneratedArticle {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON_PARSE_ERROR';
    throw new Error(`AI_PROVIDER_INVALID_ARTICLE_RESPONSE:${message}:${raw.slice(0, 300)}`);
  }
  const parsed = GeneratedArticleSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`AI_PROVIDER_INVALID_ARTICLE_RESPONSE:${parsed.error.issues[0]?.message ?? 'SCHEMA_ERROR'}`);
  }
  return parsed.data;
}

/**
 * Proveedor real configurable mediante variables de entorno (AI_PROVIDER,
 * AI_API_KEY, AI_MODEL). Soporta Anthropic, OpenAI y Groq (este último gratis
 * dentro de un límite de uso razonable); para agregar otro basta con
 * implementar `ModelCaller` y registrarlo en el switch del constructor.
 */
export class GenericContentGenerationProvider implements ContentGenerationProvider {
  private readonly caller: ModelCaller;

  constructor(providerName: string, apiKey: string, model?: string) {
    switch (providerName) {
      case 'anthropic':
        this.caller = new AnthropicCaller(apiKey, model || 'claude-sonnet-5');
        break;
      case 'openai':
        // gpt-4o-mini: barato (fracciones de céntimo por artículo), contexto de
        // 128k tokens (cabe cualquier transcripción realista de una sola vez) y
        // modo JSON nativo. Cambiable con AI_MODEL.
        this.caller = new OpenAiCaller(apiKey, model || 'gpt-4o-mini');
        break;
      case 'groq':
        // OJO: el plan GRATUITO de Groq (`on_demand`) limita a ~8000 tokens/min
        // por modelo — NO alcanza para generar un artículo de una transcripción
        // real (la petición entera devuelve 413). Sirve para transcripción, no
        // para generación. Para generar usa AI_PROVIDER=openai|anthropic, o el
        // Dev Tier de Groq. `openai/gpt-oss-120b` es el mejor modelo en Groq.
        this.caller = new GroqCaller(apiKey, model || 'openai/gpt-oss-120b');
        break;
      default:
        throw new Error(`UNSUPPORTED_AI_PROVIDER:${providerName}`);
    }
  }

  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticle> {
    if (input.transcript.segments.length <= SINGLE_PASS_MAX_SEGMENTS) {
      return this.generateArticleSinglePass(input);
    }
    return this.generateArticleMultiStage(input);
  }

  /**
   * Transcripción larga: extraer notas -> esqueleto -> redactar cada sección
   * por separado -> excerpt/FAQ/SEO/warnings -> ensamblar. Cada sección es una
   * tarea acotada, así que gpt-4o-mini la desarrolla a fondo y la longitud del
   * artículo acaba siendo proporcional al contenido de la conversación.
   */
  private async generateArticleMultiStage(input: GenerateArticleInput): Promise<GeneratedArticle> {
    const notes = await this.extractNotes(input);
    const noteSegmentIds = (refs: number[]): string[] =>
      Array.from(new Set(refs.flatMap((r) => notes[r - 1]?.sourceSegmentIds ?? [])));

    const outline = await this.buildOutline(input, notes);

    const written = await mapWithConcurrency(outline.sections, SECTION_CONCURRENCY, async (section, index) => {
      const sectionNotes = section.noteRefs.map((r) => notes[r - 1]).filter((n): n is ExtractedNote => !!n);
      const blocks = await this.writeSection(input, section.heading, sectionNotes, {
        index,
        total: outline.sections.length,
      });
      return { section, blocks };
    });

    const meta = await this.buildArticleMeta(input, outline, notes);

    const content: GeneratedArticle['content'] = [];
    written.forEach(({ section, blocks }, sIdx) => {
      const sourceSegmentIds = noteSegmentIds(section.noteRefs);
      content.push({ id: `s${sIdx}-h`, type: 'heading', level: 2, text: section.heading, sourceSegmentIds });
      blocks.forEach((b, bIdx) => {
        content.push({
          id: `s${sIdx}-b${bIdx}`,
          type: b.type,
          level: b.level,
          ordered: b.ordered,
          items: b.items,
          text: b.text,
          sourceSegmentIds,
        });
      });
    });

    const article: GeneratedArticle = {
      title: outline.title,
      excerpt: meta.excerpt,
      content,
      faq: meta.faq.map((f) => ({
        question: f.question,
        answer: f.answer,
        sourceSegmentIds: noteSegmentIds(f.noteRefs),
      })),
      seo: meta.seo,
      warnings: meta.warnings,
    };

    return remapSegmentRefs(GeneratedArticleSchema.parse(article), input);
  }

  private async buildOutline(input: GenerateArticleInput, notes: ExtractedNote[]) {
    const prompt = buildOutlinePrompt(input, notes);
    if (prompt.length > MAX_PROMPT_TOKENS * CHARS_PER_TOKEN) throw new Error('AI_TRANSCRIPT_TOO_LONG');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.caller.call({ system: JSON_SYSTEM_PROMPT, prompt, maxTokens: 3000, jsonMode: true });
        const parsed = ArticleOutlineSchema.safeParse(extractJson(raw));
        if (parsed.success) return parsed.data;
      } catch {
        /* reintento */
      }
    }
    throw new Error('AI_PROVIDER_INVALID_ARTICLE_RESPONSE:outline');
  }

  private async writeSection(
    input: GenerateArticleInput,
    heading: string,
    sectionNotes: ExtractedNote[],
    position: { index: number; total: number },
  ) {
    const notesForPrompt = sectionNotes.length > 0 ? sectionNotes : [{ point: heading, sourceSegmentIds: [] }];
    const prompt = buildSectionPrompt(input, heading, notesForPrompt, position);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.caller.call({ system: JSON_SYSTEM_PROMPT, prompt, maxTokens: 3500, jsonMode: true });
        const parsed = SectionResultSchema.safeParse(extractJson(raw));
        if (parsed.success) return parsed.data.blocks;
      } catch {
        /* reintento */
      }
    }
    // Fallback: un párrafo con las notas de la sección, para no perderla.
    return [{ type: 'paragraph' as const, text: notesForPrompt.map((n) => n.point).join(' ') }];
  }

  private async buildArticleMeta(input: GenerateArticleInput, outline: ArticleOutline, notes: ExtractedNote[]) {
    const prompt = buildArticleMetaPrompt(input, outline, notes);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.caller.call({ system: JSON_SYSTEM_PROMPT, prompt, maxTokens: 2500, jsonMode: true });
        const parsed = ArticleMetaSchema.safeParse(extractJson(raw));
        if (parsed.success) return parsed.data;
      } catch {
        /* reintento */
      }
    }
    // Fallback mínimo: la app necesita excerpt + seo válidos sí o sí.
    const slug = outline.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
    return {
      excerpt: outline.sections.map((s) => s.heading).join('. '),
      faq: [] as ArticleMeta['faq'],
      seo: {
        title: outline.title.slice(0, 60),
        slug: slug || 'articulo',
        metaDescription: outline.sections.map((s) => s.heading).join(', ').slice(0, 155),
        secondaryKeywords: [] as string[],
      },
      warnings: [] as GeneratedArticle['warnings'],
    };
  }

  /** Camino directo para transcripciones cortas: una sola llamada. */
  private async generateArticleSinglePass(input: GenerateArticleInput): Promise<GeneratedArticle> {
    const prompt = `${buildArticlePrompt(input)}

${ARTICLE_JSON_SHAPE}`;

    if (prompt.length > MAX_PROMPT_TOKENS * CHARS_PER_TOKEN) {
      throw new Error('AI_TRANSCRIPT_TOO_LONG');
    }

    const raw = await this.caller.call({
      system: JSON_SYSTEM_PROMPT,
      prompt,
      maxTokens: ARTICLE_MAX_OUTPUT_TOKENS,
      jsonMode: true,
    });
    return remapSegmentRefs(parseArticle(raw), input);
  }

  /** Etapa 1: extrae notas estructuradas de cada bloque de segmentos, en paralelo limitado. */
  private async extractNotes(input: GenerateArticleInput): Promise<ExtractedNote[]> {
    const blocks = chunk(input.transcript.segments, EXTRACT_BLOCK_SEGMENTS);

    // Guarda de tamaño sobre el bloque más grande (todos son iguales salvo el último).
    const sampleLen = buildExtractionPrompt(blocks[0]!, input.transcript.language).length;
    if (sampleLen > MAX_PROMPT_TOKENS * CHARS_PER_TOKEN) {
      throw new Error('AI_TRANSCRIPT_TOO_LONG');
    }

    const perBlock = await mapWithConcurrency(blocks, EXTRACT_CONCURRENCY, async (block) => {
      const prompt = `${buildExtractionPrompt(block, input.transcript.language)}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await this.caller.call({
            system: JSON_SYSTEM_PROMPT,
            prompt,
            maxTokens: EXTRACT_MAX_OUTPUT_TOKENS,
            jsonMode: true,
          });
          const parsed = ExtractionResultSchema.safeParse(extractJson(raw));
          if (parsed.success && parsed.data.notes.length > 0) return parsed.data.notes;
        } catch {
          /* reintento */
        }
      }
      // Fallback: si la extracción de un bloque falla, se conserva su contenido
      // como notas crudas (una por segmento) para NO perder esa parte de la
      // conversación.
      return block.map((s) => ({ point: s.text, sourceSegmentIds: [`s${s.index}`] }));
    });

    return perBlock.flat();
  }

  async rewriteSection(input: RewriteSectionInput): Promise<string> {
    const prompt = buildRewritePrompt(input);
    const text = await this.caller.call({
      system: 'Responde únicamente con el texto resultante, sin comillas ni explicaciones adicionales.',
      prompt,
      maxTokens: 1024,
    });
    return text.trim();
  }

  async generateSeoMetadata(input: SeoInput): Promise<SeoMetadata> {
    const prompt = `${buildSeoPrompt(input)}

Devuelve un JSON con exactamente esta forma:
{ "title": string, "slug": string, "metaDescription": string, "primaryKeyword"?: string, "secondaryKeywords": string[] }`;

    const raw = await this.caller.call({ system: JSON_SYSTEM_PROMPT, prompt, maxTokens: 1024, jsonMode: true });
    const parsed = SeoMetadataSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      throw new Error('AI_PROVIDER_INVALID_SEO_RESPONSE');
    }
    return parsed.data;
  }
}
