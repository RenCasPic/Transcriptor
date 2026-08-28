import type {
  ContentGenerationProvider,
  GenerateArticleInput,
  RewriteSectionInput,
  SeoInput,
} from '@/lib/ai/provider';
import {
  GeneratedArticleSchema,
  SeoMetadataSchema,
  type GeneratedArticle,
  type SeoMetadata,
} from '@/lib/validations/article';
import { buildArticlePrompt } from '@/lib/prompts/article';
import { buildRewritePrompt } from '@/lib/prompts/rewrite';
import { buildSeoPrompt } from '@/lib/prompts/seo';

const JSON_SYSTEM_PROMPT =
  'Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código markdown.';

// Tope de tokens de salida para la generación del artículo. Se mantiene
// moderado a propósito: en el plan gratuito de Groq el límite de tokens por
// minuto (TPM) es bajo y `max_tokens` cuenta contra él, así que un valor alto
// hace fallar la petición (413) incluso con transcripciones cortas. Un
// artículo típico cabe de sobra en este margen; se puede subir con AI_MODEL a
// un proveedor/plan con más TPM si hace falta.
const ARTICLE_MAX_OUTPUT_TOKENS = Number(process.env.AI_ARTICLE_MAX_TOKENS ?? 5000);

const MAX_RETRY_WAIT_MS = 20_000;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST con reintento ante 429 (límite de tokens/minuto). Respeta `retry-after`
 * o el "try again in Xs" que devuelve Groq. NO reintenta un 413 ("request too
 * large"): ahí el problema es que la petición no cabe en la ventana ni con
 * espera, así que reintentar solo perdería tiempo.
 */
async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt >= MAX_RETRIES) return response;

    const body = await response.clone().text().catch(() => '');
    const headerWait = Number(response.headers.get('retry-after')) * 1000;
    const bodyWait = Number(/try again in ([\d.]+)s/i.exec(body)?.[1]) * 1000;
    const wait = Math.min(
      MAX_RETRY_WAIT_MS,
      Math.max(1000, Number.isFinite(headerWait) && headerWait > 0 ? headerWait : bodyWait || 3000),
    );
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
      throw new Error(`AI_PROVIDER_HTTP_ERROR:${response.status}`);
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
        this.caller = new OpenAiCaller(apiKey, model || 'gpt-4o-mini');
        break;
      case 'groq':
        // El plan GRATUITO de Groq (`on_demand`) limita a ~8000 tokens/minuto
        // por modelo, lo que NO alcanza para generar un artículo a partir de una
        // transcripción de más de ~5-6 min (la petición entera —prompt + salida—
        // supera esa ventana y devuelve 413). Para usar la app con contenido
        // real hay que activar el **Dev Tier** de Groq (gratis, solo verifica
        // identidad) o usar AI_PROVIDER=anthropic|openai. `openai/gpt-oss-120b`
        // es el mejor modelo disponible en Groq; se puede cambiar con AI_MODEL.
        this.caller = new GroqCaller(apiKey, model || 'openai/gpt-oss-120b');
        break;
      default:
        throw new Error(`UNSUPPORTED_AI_PROVIDER:${providerName}`);
    }
  }

  async generateArticle(input: GenerateArticleInput): Promise<GeneratedArticle> {
    const prompt = `${buildArticlePrompt(input)}

Devuelve un JSON con exactamente esta forma:
{
  "title": string,
  "excerpt": string,
  "content": [{ "id": string, "type": "heading"|"paragraph"|"list"|"quote", "level"?: 2|3, "ordered"?: boolean, "items"?: string[], "text"?: string, "sourceSegmentIds": string[] }],
  "faq": [{ "question": string, "answer": string, "sourceSegmentIds": string[] }],
  "seo": { "title": string, "slug": string, "metaDescription": string, "primaryKeyword"?: string, "secondaryKeywords": string[] },
  "warnings": [{ "blockId": string|null, "type": "unsupported_claim"|"number_verification"|"name_verification"|"date_verification"|"possible_hallucination"|"missing_source", "message": string }]
}`;

    const raw = await this.caller.call({
      system: JSON_SYSTEM_PROMPT,
      prompt,
      maxTokens: ARTICLE_MAX_OUTPUT_TOKENS,
      jsonMode: true,
    });
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
    return remapSegmentRefs(parsed.data, input);
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
