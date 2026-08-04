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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        this.caller = new GroqCaller(apiKey, model || 'llama-3.3-70b-versatile');
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

    const raw = await this.caller.call({ system: JSON_SYSTEM_PROMPT, prompt, maxTokens: 8192, jsonMode: true });
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
