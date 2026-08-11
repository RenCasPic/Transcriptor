import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoTranscriptionProvider } from '@/lib/ai/transcription/demo-provider';
import { getDemoTranscript } from '@/lib/content/demo-transcript';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DemoTranscriptionProvider', () => {
  it('devuelve un TranscriptResult con el mismo contrato que un proveedor real (fullText + segments con start/end/confidence)', async () => {
    const provider = new DemoTranscriptionProvider();
    const result = await provider.transcribe({ language: 'es' });

    expect(typeof result.fullText).toBe('string');
    expect(result.fullText.length).toBeGreaterThan(0);
    expect(Array.isArray(result.segments)).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    for (const segment of result.segments) {
      expect(typeof segment.index).toBe('number');
      expect(typeof segment.startSeconds).toBe('number');
      expect(typeof segment.endSeconds).toBe('number');
      expect(typeof segment.text).toBe('string');
      expect(segment.text.length).toBeGreaterThan(0);
    }
  });

  it('ignora por completo el input: no necesita mediaUrl ni audioBlob (a diferencia de Groq/Whisper)', async () => {
    const provider = new DemoTranscriptionProvider();
    await expect(provider.transcribe({ language: 'es' })).resolves.toBeDefined();
    await expect(
      provider.transcribe({ language: 'es', mediaUrl: 'https://no-existe.invalid/audio.mp3' }),
    ).resolves.toBeDefined();
  });

  it('usa la transcripción "medium" por defecto', async () => {
    vi.stubEnv('DEMO_TRANSCRIPT_LENGTH', undefined as unknown as string);
    const provider = new DemoTranscriptionProvider();
    const result = await provider.transcribe({ language: 'es' });
    const medium = getDemoTranscript('medium');
    expect(result.fullText).toContain(medium.text.split('\n\n')[0]!.split(': ')[1]!.slice(0, 30));
  });

  it('respeta DEMO_TRANSCRIPT_LENGTH=short devolviendo menos segmentos que "long"', async () => {
    vi.stubEnv('DEMO_TRANSCRIPT_LENGTH', 'short');
    const shortResult = await new DemoTranscriptionProvider().transcribe({ language: 'es' });

    vi.stubEnv('DEMO_TRANSCRIPT_LENGTH', 'long');
    const longResult = await new DemoTranscriptionProvider().transcribe({ language: 'es' });

    expect(shortResult.segments.length).toBeLessThan(longResult.segments.length);
    expect(shortResult.fullText.length).toBeLessThan(longResult.fullText.length);
  });

  it('la transcripción "long" tiene suficiente contenido para probar un artículo largo (varios miles de caracteres)', async () => {
    vi.stubEnv('DEMO_TRANSCRIPT_LENGTH', 'long');
    const result = await new DemoTranscriptionProvider().transcribe({ language: 'es' });
    expect(result.fullText.length).toBeGreaterThan(3000);
    expect(result.segments.length).toBeGreaterThan(15);
  });

  it('cae a "medium" si DEMO_TRANSCRIPT_LENGTH tiene un valor inválido', async () => {
    vi.stubEnv('DEMO_TRANSCRIPT_LENGTH', 'gigante');
    const result = await new DemoTranscriptionProvider().transcribe({ language: 'es' });
    const medium = getDemoTranscript('medium');
    expect(result.segments.length).toBe(medium.text.split(/\n{2,}/).length);
  });
});
