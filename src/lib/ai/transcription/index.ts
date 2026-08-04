import type { TranscriptionProvider } from '@/lib/ai/provider';
import { DemoTranscriptionProvider } from './demo-provider';
import { WhisperTranscriptionProvider } from './whisper-provider';
import { GroqTranscriptionProvider } from './groq-provider';

/**
 * Fábrica del proveedor de transcripción. Se controla con las variables de
 * entorno TRANSCRIPTION_PROVIDER ("demo" | "whisper" | "groq") y
 * TRANSCRIPTION_API_KEY. "groq" usa la API de Groq (Whisper gratis, sin
 * tarjeta de crédito, con límite de uso razonable) como alternativa sin costo
 * a "whisper" (OpenAI, de pago) mientras no se contrate un proveedor
 * definitivo. Sin clave configurada, siempre recurre al proveedor demo para
 * no romper el modo de exploración sin servicios externos.
 */
export function getTranscriptionProvider(): TranscriptionProvider {
  const providerName = (process.env.TRANSCRIPTION_PROVIDER ?? 'demo').toLowerCase();
  const apiKey = process.env.TRANSCRIPTION_API_KEY;

  if (providerName === 'whisper' && apiKey) {
    return new WhisperTranscriptionProvider(apiKey);
  }

  if (providerName === 'groq' && apiKey) {
    return new GroqTranscriptionProvider(apiKey);
  }

  return new DemoTranscriptionProvider();
}
