import type { ContentGenerationProvider } from '@/lib/ai/provider';
import { GenericContentGenerationProvider } from './generic-provider';

const DEFAULT_AI_PROVIDER = 'groq';

/**
 * Falta configurar un proveedor de IA (sin `AI_API_KEY` ni `GROQ_API_KEY`).
 * Se lanza en `getContentGenerationProvider()` y la Server Action la traduce a
 * un `ActionResult` de error accionable en vez de un fallo genérico.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI_NOT_CONFIGURED');
    this.name = 'AiNotConfiguredError';
  }
}

/** Clave de IA efectiva: `AI_API_KEY` específica o la `GROQ_API_KEY` compartida. */
function resolveAiApiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.GROQ_API_KEY || undefined;
}

/**
 * Fábrica del proveedor de generación de contenido. El proveedor activo se
 * controla con `AI_PROVIDER` ("groq" | "anthropic" | "openai"); por defecto
 * "groq" (gratis dentro de un límite de uso razonable, sin tarjeta). Requiere
 * una API key: sin ella lanza `AiNotConfiguredError`. Nunca se debe instanciar
 * desde código de cliente.
 */
export function getContentGenerationProvider(): ContentGenerationProvider {
  const providerName = (process.env.AI_PROVIDER || DEFAULT_AI_PROVIDER).toLowerCase();
  const apiKey = resolveAiApiKey();
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }
  return new GenericContentGenerationProvider(providerName, apiKey, process.env.AI_MODEL);
}

/** Si hay una API key de IA configurada (para avisos de setup en la UI). */
export function isContentGenerationConfigured(): boolean {
  return !!resolveAiApiKey();
}
