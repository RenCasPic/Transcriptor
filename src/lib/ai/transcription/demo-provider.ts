import type { TranscriptionInput, TranscriptionProvider, TranscriptResult } from '@/lib/ai/provider';
import { DEMO_TRANSCRIPT_TEXT } from '@/lib/content/demo-transcript';
import { normalizePlainText } from '@/lib/content/normalize';

/**
 * Proveedor de transcripción de demostración. No llama a ningún servicio
 * externo: permite explorar el flujo completo (incluida la futura subida de
 * audio/video) sin depender de una API de transcripción configurada.
 */
export class DemoTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_input: TranscriptionInput): Promise<TranscriptResult> {
    const normalized = normalizePlainText(DEMO_TRANSCRIPT_TEXT);

    return {
      fullText: normalized.fullText,
      segments: normalized.segments.map((segment, i) => ({
        index: segment.index,
        speaker: segment.speaker,
        startSeconds: i * 12,
        endSeconds: i * 12 + 10,
        text: segment.text,
        confidence: 0.98,
      })),
    };
  }
}
