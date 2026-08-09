import type { TranscriptionInput, TranscriptionProvider, TranscriptResult } from '@/lib/ai/provider';

interface GroqSegment {
  start: number;
  end: number;
  text: string;
}

interface GroqVerboseJsonResponse {
  text: string;
  segments?: GroqSegment[];
}

/**
 * Proveedor de transcripción real usando la API de Groq (compatible con el
 * formato de OpenAI), que ofrece transcripción con Whisper gratis dentro de
 * un límite de uso razonable, sin necesitar tarjeta de crédito. Pensado como
 * alternativa sin costo mientras no se contrate un proveedor de pago (p. ej.
 * OpenAI Whisper vía `whisper-provider.ts`, que usa el mismo `TranscriptionProvider`).
 *
 * Igual que con Whisper: límite duro de archivo de 25 MB, sin conversión de
 * video a audio en el servidor. El nombre del archivo enviado debe conservar
 * su extensión real, porque el servicio determina el formato por ahí.
 */
export class GroqTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly apiKey: string) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptResult> {
    let fileBlob: Blob;
    if (input.audioBlob) {
      fileBlob = input.audioBlob;
    } else if (input.mediaUrl) {
      const fileResponse = await fetch(input.mediaUrl);
      if (!fileResponse.ok) {
        throw new Error('TRANSCRIPTION_SOURCE_FETCH_FAILED');
      }
      fileBlob = await fileResponse.blob();
    } else {
      throw new Error('TRANSCRIPTION_MISSING_MEDIA_URL');
    }

    if (fileBlob.size > 26_214_400) {
      throw new Error('TRANSCRIPTION_FILE_TOO_LARGE');
    }

    const formData = new FormData();
    const extension = input.fileExtension || 'mp4';
    formData.append('file', fileBlob, `media.${extension}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    if (input.language) {
      formData.append('language', input.language);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('TRANSCRIPTION_FILE_TOO_LARGE');
      }
      throw new Error(`TRANSCRIPTION_PROVIDER_HTTP_ERROR:${response.status}`);
    }

    const data = (await response.json()) as GroqVerboseJsonResponse;
    const segments = data.segments ?? [];

    if (segments.length === 0) {
      return {
        fullText: data.text.trim(),
        segments: data.text.trim()
          ? [{ index: 0, speaker: null, startSeconds: 0, endSeconds: 0, text: data.text.trim(), confidence: null }]
          : [],
      };
    }

    return {
      fullText: data.text.trim(),
      segments: segments.map((segment, index) => ({
        index,
        speaker: null,
        startSeconds: segment.start,
        endSeconds: segment.end,
        text: segment.text.trim(),
        confidence: null,
      })),
    };
  }
}
