import type { TranscriptionProvider } from '@/lib/ai/provider';
import { WhisperTranscriptionProvider } from './whisper-provider';
import { GroqTranscriptionProvider } from './groq-provider';

const DEFAULT_TRANSCRIPTION_PROVIDER = 'groq';

/**
 * Falta configurar un proveedor de transcripción (sin `TRANSCRIPTION_API_KEY`
 * ni `GROQ_API_KEY`). Se traduce a un error accionable en la capa de acciones.
 */
export class TranscriptionNotConfiguredError extends Error {
  constructor() {
    super('TRANSCRIPTION_NOT_CONFIGURED');
    this.name = 'TranscriptionNotConfiguredError';
  }
}

/** Clave efectiva: `TRANSCRIPTION_API_KEY` específica o la `GROQ_API_KEY` compartida. */
function resolveTranscriptionApiKey(): string | undefined {
  return process.env.TRANSCRIPTION_API_KEY || process.env.GROQ_API_KEY || undefined;
}

/**
 * Fábrica del proveedor de transcripción. `TRANSCRIPTION_PROVIDER` ("groq" |
 * "whisper"); por defecto "groq" (Whisper servido gratis por Groq dentro de un
 * límite de uso razonable, sin tarjeta). `whisper` usa la API de OpenAI (con
 * costo). Requiere una API key: sin ella lanza `TranscriptionNotConfiguredError`.
 */
export function getTranscriptionProvider(): TranscriptionProvider {
  const providerName = (process.env.TRANSCRIPTION_PROVIDER || DEFAULT_TRANSCRIPTION_PROVIDER).toLowerCase();
  const apiKey = resolveTranscriptionApiKey();
  if (!apiKey) {
    throw new TranscriptionNotConfiguredError();
  }

  if (providerName === 'whisper') {
    return new WhisperTranscriptionProvider(apiKey);
  }
  if (providerName === 'groq') {
    return new GroqTranscriptionProvider(apiKey);
  }
  throw new Error(`UNSUPPORTED_TRANSCRIPTION_PROVIDER:${providerName}`);
}

/** Si hay una API key de transcripción configurada (para avisos de setup en la UI). */
export function isTranscriptionConfigured(): boolean {
  return !!resolveTranscriptionApiKey();
}
