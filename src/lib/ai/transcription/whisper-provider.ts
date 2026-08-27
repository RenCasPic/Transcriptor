import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionProviderLimits,
  TranscriptResult,
} from '@/lib/ai/provider';
import { PROVIDER_REQUEST_MAX_BYTES } from '@/lib/media/limits';

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperVerboseJsonResponse {
  text: string;
  segments?: WhisperSegment[];
}

/**
 * Proveedor de transcripción real usando la API de Whisper de OpenAI.
 * Usa específicamente el modelo "whisper-1": es, a la fecha, el único modelo
 * de OpenAI que devuelve `verbose_json` con timestamps por segmento, que es
 * lo que necesitamos para poblar `transcript_segments`.
 *
 * Límite duro de la API: 25 MB por archivo. No se hace conversión de video a
 * audio en el servidor (requeriría ffmpeg, fuera de alcance del MVP); se
 * envía el archivo tal cual en los formatos que Whisper acepta de forma nativa
 * (mp4, mov, webm, mp3, wav, m4a, mpeg, mpga).
 */
export class WhisperTranscriptionProvider implements TranscriptionProvider {
  readonly limits: TranscriptionProviderLimits = {
    maxRequestBytes: PROVIDER_REQUEST_MAX_BYTES,
    maxRequestSeconds: null,
    supportsChunking: true,
  };

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

    if (fileBlob.size > this.limits.maxRequestBytes) {
      throw new Error('TRANSCRIPTION_FILE_TOO_LARGE');
    }

    const formData = new FormData();
    const extension = input.fileExtension || 'mp4';
    formData.append('file', fileBlob, `media.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    if (input.language) {
      formData.append('language', input.language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
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

    const data = (await response.json()) as WhisperVerboseJsonResponse;
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
