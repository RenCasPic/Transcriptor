import type { ContentGenerationProvider } from '@/lib/ai/provider';
import { MockContentGenerationProvider } from './mock-provider';
import { GenericContentGenerationProvider } from './generic-provider';

/**
 * Fábrica del proveedor de generación de contenido. El proveedor activo se
 * controla con la variable de entorno AI_PROVIDER ("mock" | "groq" | "anthropic" | "openai").
 * "groq" es gratis (sin tarjeta) dentro de un límite de uso razonable, y usa
 * la misma API key que TRANSCRIPTION_PROVIDER=groq si también la configuraste.
 * Nunca se debe instanciar un proveedor real desde código de cliente.
 */
export function getContentGenerationProvider(): ContentGenerationProvider {
  const providerName = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();

  if (providerName === 'mock' || !providerName) {
    return new MockContentGenerationProvider();
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    // Sin clave configurada, se recurre al proveedor mock para no romper el modo demo.
    return new MockContentGenerationProvider();
  }

  return new GenericContentGenerationProvider(providerName, apiKey, process.env.AI_MODEL);
}
