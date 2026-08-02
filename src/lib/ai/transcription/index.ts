import type { TranscriptionProvider } from '@/lib/ai/provider';
import { DemoTranscriptionProvider } from './demo-provider';
import { WhisperTranscriptionProvider } from './whisper-provider';

/**
 * Fábrica del proveedor de transcripción. Se controla con las variables de
 * entorno TRANSCRIPTION_PROVIDER ("demo" | "whisper") y TRANSCRIPTION_API_KEY.
 * Sin clave configurada, siempre recurre al proveedor demo para no romper el
 * modo de exploración sin servicios externos.
 */
export function getTranscriptionProvider(): TranscriptionProvider {
  const providerName = (process.env.TRANSCRIPTION_PROVIDER ?? 'demo').toLowerCase();
  const apiKey = process.env.TRANSCRIPTION_API_KEY;

  if (providerName === 'whisper' && apiKey) {
    return new WhisperTranscriptionProvider(apiKey);
  }

  return new DemoTranscriptionProvider();
}
