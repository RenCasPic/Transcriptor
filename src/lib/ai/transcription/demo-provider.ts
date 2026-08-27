import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionProviderLimits,
  TranscriptResult,
} from '@/lib/ai/provider';
import { getConfiguredDemoTranscriptLength, getDemoTranscript } from '@/lib/content/demo-transcript';
import { normalizePlainText } from '@/lib/content/normalize';

// Espera artificial antes de devolver la transcripción demo: sin esto, el
// fallback de audio de YouTube en modo demo resolvería instantáneamente, lo
// que se vería congelado/sospechoso comparado con el resto de la UX (que sí
// muestra "extrayendo audio... transcribiendo..." durante varios segundos).
const SIMULATED_DELAY_MS = 1800;

/**
 * Proveedor de transcripción de demostración. No llama a ningún servicio
 * externo: permite explorar el flujo completo (subida de archivo, import de
 * YouTube con o sin subtítulos, editor, SEO, publicación) sin depender de
 * una API de transcripción real configurada. Ignora por completo el
 * audio/mediaUrl real que se le pase — siempre devuelve el mismo contenido
 * de ejemplo (elegido por `DEMO_TRANSCRIPT_LENGTH`), pero con exactamente el
 * mismo contrato `TranscriptResult` que `GroqTranscriptionProvider`, así que
 * quien lo consume (`transcribeCore`, `transcribeYoutubeAudioAction`) no
 * necesita saber cuál de los dos está usando.
 */
export class DemoTranscriptionProvider implements TranscriptionProvider {
  // El proveedor demo ignora el audio real: acepta cualquier tamaño y trocear
  // no tendría sentido (siempre devuelve el mismo texto de ejemplo).
  readonly limits: TranscriptionProviderLimits = {
    maxRequestBytes: Number.MAX_SAFE_INTEGER,
    maxRequestSeconds: null,
    supportsChunking: false,
  };

  async transcribe(_input: TranscriptionInput): Promise<TranscriptResult> {
    // Sin espera en tests: sería puro tiempo perdido en cada corrida de la
    // suite sin aportar ninguna cobertura adicional.
    if (process.env.NODE_ENV !== 'test') {
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
    }

    const { text } = getDemoTranscript(getConfiguredDemoTranscriptLength());
    const normalized = normalizePlainText(text);

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
