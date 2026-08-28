import type { ContentGenerationProvider } from '@/lib/ai/provider';
import { GenericContentGenerationProvider } from './generic-provider';

// La GENERACIÓN de artículos usa OpenAI por defecto: el plan gratuito de Groq
// no tiene suficiente límite de tokens/minuto para una transcripción real
// (ver comentario en `GenericContentGenerationProvider`). Cambiable con
// AI_PROVIDER=anthropic|groq.
const DEFAULT_AI_PROVIDER = 'openai';

/**
 * Falta configurar un proveedor de IA (sin `AI_API_KEY`). Se lanza en
 * `getContentGenerationProvider()` y la capa de acciones la traduce a un
 * `ActionResult` de error accionable en vez de un fallo genérico.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI_NOT_CONFIGURED');
    this.name = 'AiNotConfiguredError';
  }
}

/**
 * Clave de IA efectiva. `AI_API_KEY` manda siempre; `GROQ_API_KEY` solo se
 * acepta como fallback cuando AI_PROVIDER=groq (una clave de Groq no sirve para
 * OpenAI/Anthropic).
 */
function resolveAiApiKey(providerName: string): string | undefined {
  if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
  if (providerName === 'groq') return process.env.GROQ_API_KEY || undefined;
  return undefined;
}

function resolveProviderName(): string {
  return (process.env.AI_PROVIDER || DEFAULT_AI_PROVIDER).toLowerCase();
}

/**
 * Fábrica del proveedor de generación de contenido. El proveedor activo se
 * controla con `AI_PROVIDER` ("openai" | "anthropic" | "groq"); por defecto
 * "openai" (`gpt-4o-mini`). Requiere una API key: sin ella lanza
 * `AiNotConfiguredError`. Nunca se debe instanciar desde código de cliente
 * (la API key jamás debe llegar al navegador).
 */
export function getContentGenerationProvider(): ContentGenerationProvider {
  const providerName = resolveProviderName();
  const apiKey = resolveAiApiKey(providerName);
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }
  return new GenericContentGenerationProvider(providerName, apiKey, process.env.AI_MODEL);
}

/** Si hay una API key de IA usable para el proveedor activo (para avisos de setup en la UI). */
export function isContentGenerationConfigured(): boolean {
  return !!resolveAiApiKey(resolveProviderName());
}
