import { describe, expect, it } from 'vitest';
import { mergeChunkTranscripts } from '@/lib/media/merge-transcripts';
import type { TranscriptResult } from '@/lib/ai/provider';

function result(segments: Array<[number, number, string]>): TranscriptResult {
  return {
    fullText: segments.map((s) => s[2]).join('\n\n'),
    segments: segments.map(([startSeconds, endSeconds, text], index) => ({
      index,
      speaker: null,
      startSeconds,
      endSeconds,
      text,
      confidence: null,
    })),
  };
}

describe('mergeChunkTranscripts', () => {
  it('con un solo chunk devuelve la transcripción equivalente', () => {
    const merged = mergeChunkTranscripts([
      { startSeconds: 0, result: result([[0, 2, 'Hola'], [2, 4, 'mundo']]) },
    ]);
    expect(merged.segments.map((s) => s.text)).toEqual(['Hola', 'mundo']);
    expect(merged.segments.map((s) => s.startSeconds)).toEqual([0, 2]);
    expect(merged.fullText).toBe('Hola\n\nmundo');
  });

  it('desplaza los timestamps de cada chunk por su offset y reindexa de forma correlativa', () => {
    const merged = mergeChunkTranscripts([
      { startSeconds: 0, result: result([[0, 5, 'a'], [5, 10, 'b']]) },
      { startSeconds: 600, result: result([[0, 4, 'c'], [4, 9, 'd']]) },
      { startSeconds: 1200, result: result([[0, 3, 'e']]) },
    ]);

    expect(merged.segments.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    expect(merged.segments.map((s) => s.text)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(merged.segments.map((s) => s.startSeconds)).toEqual([0, 5, 600, 604, 1200]);
    expect(merged.segments.map((s) => s.endSeconds)).toEqual([5, 10, 604, 609, 1203]);
  });

  it('ordena los chunks por startSeconds aunque lleguen desordenados', () => {
    const merged = mergeChunkTranscripts([
      { startSeconds: 600, result: result([[0, 2, 'segundo']]) },
      { startSeconds: 0, result: result([[0, 2, 'primero']]) },
    ]);
    expect(merged.segments.map((s) => s.text)).toEqual(['primero', 'segundo']);
    expect(merged.segments.map((s) => s.startSeconds)).toEqual([0, 600]);
  });

  it('preserva speaker y confidence de cada segmento', () => {
    const merged = mergeChunkTranscripts([
      {
        startSeconds: 10,
        result: {
          fullText: 'x',
          segments: [{ index: 0, speaker: 'Ana', startSeconds: 1, endSeconds: 2, text: 'x', confidence: 0.9 }],
        },
      },
    ]);
    expect(merged.segments[0]).toMatchObject({ speaker: 'Ana', confidence: 0.9, startSeconds: 11, endSeconds: 12 });
  });
});
