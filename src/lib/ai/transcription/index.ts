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

/**
 * Indica si hay un proveedor de transcripción REAL configurado (Groq o
 * Whisper con su API key), en vez del modo demo (que ignora el audio/video
 * subido y siempre devuelve el mismo texto de ejemplo). Se usa para avisar
 * en la interfaz antes de que el usuario suba contenido y se lleve la
 * sorpresa de un artículo que no tiene nada que ver con su video.
 */
export function isRealTranscriptionConfigured(): boolean {
  const providerName = (process.env.TRANSCRIPTION_PROVIDER ?? 'demo').toLowerCase();
  const apiKey = process.env.TRANSCRIPTION_API_KEY;
  return (providerName === 'whisper' || providerName === 'groq') && !!apiKey;
}
