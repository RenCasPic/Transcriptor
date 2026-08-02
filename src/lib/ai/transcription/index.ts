import type { TranscriptionProvider } from '@/lib/ai/provider';
import { DemoTranscriptionProvider } from './demo-provider';

/**
 * Fábrica del proveedor de transcripción. Hoy solo existe el modo "demo"
 * (TRANSCRIPTION_PROVIDER=demo). La interfaz ya está lista para que un futuro
 * proveedor real (p. ej. Whisper) se conecte sin cambiar el código que lo consume.
 */
export function getTranscriptionProvider(): TranscriptionProvider {
  const providerName = (process.env.TRANSCRIPTION_PROVIDER ?? 'demo').toLowerCase();

  switch (providerName) {
    case 'demo':
    default:
      return new DemoTranscriptionProvider();
  }
}
