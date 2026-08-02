import type { ContentGenerationProvider } from '@/lib/ai/provider';
import { MockContentGenerationProvider } from './mock-provider';
import { GenericContentGenerationProvider } from './generic-provider';

/**
 * Fábrica del proveedor de generación de contenido. El proveedor activo se
 * controla con la variable de entorno AI_PROVIDER ("mock" | "anthropic" | "openai").
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
