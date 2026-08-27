import type { TranscriptResult, TranscriptResultSegment } from '@/lib/ai/provider';

export interface ChunkTranscript {
  /** Segundo del audio original en el que empieza este chunk. */
  startSeconds: number;
  result: TranscriptResult;
}

/**
 * Recompone varias transcripciones parciales (una por chunk de audio) en una
 * sola transcripción ordenada:
 *
 * - Cada chunk se transcribe por separado, así que sus timestamps son
 *   relativos al chunk (empiezan en 0). Aquí se les suma el offset del chunk
 *   dentro del audio original, de modo que los timestamps finales son
 *   absolutos y monótonos.
 * - Los segmentos se reindexan de forma correlativa (0, 1, 2, ...) para que
 *   `transcript_segments.segment_index` y, por tanto, la trazabilidad
 *   bloque→segmento del artículo, sigan funcionando igual que con una
 *   transcripción de una sola pasada.
 * - `fullText` se reconstruye a partir de los segmentos ya ordenados.
 *
 * Con un solo chunk (archivo pequeño, sin trocear) el resultado es
 * equivalente a devolver la transcripción tal cual.
 */
export function mergeChunkTranscripts(chunks: ChunkTranscript[]): TranscriptResult {
  const ordered = [...chunks].sort((a, b) => a.startSeconds - b.startSeconds);
  const segments: TranscriptResultSegment[] = [];

  for (const chunk of ordered) {
    for (const segment of chunk.result.segments) {
      segments.push({
        index: segments.length,
        speaker: segment.speaker,
        startSeconds: round(segment.startSeconds + chunk.startSeconds),
        endSeconds: round(segment.endSeconds + chunk.startSeconds),
        text: segment.text,
        confidence: segment.confidence,
      });
    }
  }

  return {
    fullText: segments.map((s) => s.text).join('\n\n').trim(),
    segments,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
